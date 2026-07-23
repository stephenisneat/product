import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { publishCreativeToChannel } from "@/lib/channels/publish-creative";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { getCreativeRepository } from "@/repositories";

export const runtime = "nodejs";

const bodySchema = z.object({
  provider: z.enum(["google", "meta"]),
  connectionId: z.string().uuid(),
  finalUrl: z.string().url(),
  dailyBudget: z.number().positive().max(1_000_000).optional(),
  chargeSpend: z.boolean().optional(),
  metaPageId: z.string().trim().min(1).optional(),
  youtubeVideoId: z.string().trim().min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Publish a ready creative to Google Ads or Meta as a paused campaign + ad. */
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (!canManageMembers(active.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can publish creatives." },
      { status: 403 },
    );
  }

  const { id } = await params;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid body",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  try {
    const creatives = await getCreativeRepository();
    const creative = await creatives.getById(id);
    if (!creative || creative.workspaceId !== active.workspace.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await publishCreativeToChannel({
      workspaceId: active.workspace.id,
      plan: active.workspace.plan ?? "free",
      creative,
      provider: body.provider,
      connectionId: body.connectionId,
      finalUrl: body.finalUrl,
      dailyBudget: body.dailyBudget,
      chargeSpend: body.chargeSpend,
      userId: user.id,
      metaPageId: body.metaPageId,
      youtubeVideoId: body.youtubeVideoId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    logServerError("creatives.publish", error);
    return NextResponse.json(
      { error: unknownErrorMessage(error, "Failed to publish creative") },
      { status: 502 },
    );
  }
}
