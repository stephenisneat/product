import { NextResponse } from "next/server";
import { z } from "zod";
import type { Creative } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { normalizeWorkspacePlan } from "@/lib/billing/entitlements";
import {
  assertCanLinkCreativesToCampaigns,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import { nextStageAfterAccept } from "@/lib/jobs/creative-stubs";
import { enqueueGenerateCreativeStageJob } from "@/lib/jobs/enqueue";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { hasServiceRole } from "@/lib/supabase/service";
import { getCreativeRepository } from "@/repositories";

export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
  }),
  z.object({
    action: z.literal("reject"),
  }),
  z.object({
    action: z.literal("revise"),
    feedback: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("set_campaigns"),
    campaignIds: z.array(z.string().min(1)),
  }),
]);

function revisePrompt(creative: Creative, feedback?: string): string {
  const notes = feedback?.trim();
  const base = `Revise the ${creative.stage} for video creative "${creative.title}" (id ${creative.id}).`;
  if (notes) {
    return `${base}\n\nFeedback: ${notes}\n\nWhen ready, resubmit generation for this creative.`;
  }
  return `${base}\n\nTell me what to change, then resubmit generation for this creative.`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await context.params;
  const creatives = await getCreativeRepository();
  const creative = await creatives.getById(id);
  if (!creative || creative.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ creative });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const creatives = await getCreativeRepository();
  const existing = await creatives.getById(id);
  if (!existing || existing.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { action } = parsed.data;

  if (action === "set_campaigns") {
    try {
      const campaignIds = await resolveProductCampaignIds(
        existing.productId,
        parsed.data.campaignIds,
      );
      await assertCanLinkCreativesToCampaigns({
        plan: normalizeWorkspacePlan(active.workspace.plan),
        campaignIds,
        countByCampaign: (id) => creatives.countByCampaign(id),
        alreadyLinked: existing.campaignIds,
      });
      const creative = await creatives.update(id, { campaignIds });
      return NextResponse.json({ creative });
    } catch (err) {
      if (err instanceof PlanEntitlementError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      logServerError("api.creatives.set_campaigns", err, { creativeId: id });
      return NextResponse.json(
        { error: unknownErrorMessage(err, "Failed to update campaigns.") },
        { status: 500 },
      );
    }
  }

  const feedback =
    action === "revise" ? parsed.data.feedback : undefined;

  if (action === "reject") {
    if (
      existing.status !== "awaiting_review" &&
      existing.status !== "revising"
    ) {
      return NextResponse.json(
        { error: "Only reviewable creatives can be rejected." },
        { status: 409 },
      );
    }
    const creative = await creatives.update(id, {
      status: "rejected",
      activeJobId: null,
    });
    return NextResponse.json({ creative });
  }

  if (action === "revise") {
    if (existing.status !== "awaiting_review") {
      return NextResponse.json(
        { error: "Only awaiting-review creatives can be revised." },
        { status: 409 },
      );
    }
    const creative = await creatives.update(id, {
      status: "revising",
      revisionFeedback: feedback?.trim() || null,
    });
    return NextResponse.json({
      creative,
      revisePrompt: revisePrompt(creative, feedback),
    });
  }

  // accept
  if (existing.status !== "awaiting_review") {
    return NextResponse.json(
      { error: "Only awaiting-review creatives can be accepted." },
      { status: 409 },
    );
  }

  const nextStage = nextStageAfterAccept(existing.stage);
  if (!nextStage) {
    const creative = await creatives.update(id, {
      status: "ready",
      activeJobId: null,
      revisionFeedback: null,
    });
    return NextResponse.json({ creative });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  try {
    const job = await enqueueGenerateCreativeStageJob({
      workspaceId: active.workspace.id,
      createdBy: user.id,
      trigger: "api",
      input: {
        creativeId: existing.id,
        productId: existing.productId,
        stage: nextStage,
      },
    });
    const creative = await creatives.getById(id);
    return NextResponse.json({
      creative: creative ?? existing,
      jobId: job.id,
    });
  } catch (err) {
    logServerError("api.creatives.accept.next_stage", err, {
      creativeId: existing.id,
      stage: nextStage,
    });
    return NextResponse.json(
      {
        error: unknownErrorMessage(err, "Failed to start next stage."),
      },
      { status: 500 },
    );
  }
}
