import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import { createTikTokClientFromConnection } from "@/lib/channels/providers/tiktok/session";
import { getAdConnectionRepository } from "@/repositories";

export const runtime = "nodejs";

type Params = { params: Promise<{ connectionId: string }> };

async function requireTikTokConnection(
  connectionId: string,
  opts?: { requireAdmin?: boolean },
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const active = await getActiveWorkspace();
  if (!active) {
    return {
      error: NextResponse.json({ error: "No workspace available" }, { status: 400 }),
    };
  }
  if (opts?.requireAdmin && !canManageMembers(active.role)) {
    return {
      error: NextResponse.json(
        { error: "Only workspace owners and admins can modify TikTok Ads." },
        { status: 403 },
      ),
    };
  }
  const repo = await getAdConnectionRepository();
  const connection = await repo.getConnection(connectionId);
  if (
    !connection ||
    connection.workspaceId !== active.workspace.id ||
    connection.provider !== "tiktok"
  ) {
    return {
      error: NextResponse.json({ error: "Connection not found" }, { status: 404 }),
    };
  }
  if (connection.status !== "active" || !connection.externalAccountId) {
    return {
      error: NextResponse.json(
        { error: "TikTok connection is not ready." },
        { status: 400 },
      ),
    };
  }
  try {
    const client = await createTikTokClientFromConnection(connection);
    return { client };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authenticate with TikTok";
    return { error: NextResponse.json({ error: message }, { status: 502 }) };
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireTikTokConnection(connectionId);
  if ("error" in result) return result.error;
  try {
    const campaigns = await result.client.listCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list TikTok campaigns";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(256),
  budget: z.number().positive().optional(),
  status: z.enum(["ENABLE", "DISABLE"]).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireTikTokConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;
  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid campaign payload",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }
  try {
    const created = await result.client.createCampaign(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create TikTok campaign";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
