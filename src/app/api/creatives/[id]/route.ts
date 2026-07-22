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
import {
  deleteCreativeWithJob,
  pauseCreativeGeneration,
  reconcileCreativeAgainstTrigger,
  resumeCreativeGeneration,
} from "@/lib/jobs/creative-job-controls";
import { nextStageAfterAccept } from "@/lib/jobs/creative-stubs";
import {
  enqueueGenerateCreativeStageJob,
  enqueueRenderCreativeVideoJob,
  reopenCreative,
  resubmitCreativeStage,
} from "@/lib/jobs/enqueue";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { hasServiceRole } from "@/lib/supabase/service";
import { getCreativeRepository } from "@/repositories";
import {
  creativeExternalAdRefsSchema,
  videoClipSchema,
} from "@/domain";

export const runtime = "nodejs";

const videoEditClipSchema = videoClipSchema.pick({
  sceneId: true,
  url: true,
  audioUrl: true,
  thumbnailUrl: true,
  durationSec: true,
  sourceDurationSec: true,
  caption: true,
  prompt: true,
});

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
    action: z.literal("resubmit"),
    feedback: z.string().trim().max(2000).optional(),
    brief: z.string().trim().max(4000).optional(),
  }),
  z.object({
    action: z.literal("reopen"),
  }),
  z.object({
    action: z.literal("update_video_edits"),
    clips: z.array(videoEditClipSchema).min(1),
    reexport: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("set_external_ad_refs"),
    externalAdRefs: creativeExternalAdRefsSchema,
  }),
  z.object({
    action: z.literal("set_campaigns"),
    campaignIds: z.array(z.string().min(1)),
  }),
  z.object({
    action: z.literal("pause"),
  }),
  z.object({
    action: z.literal("resume"),
  }),
]);

function revisePrompt(creative: Creative, feedback?: string): string {
  const kindLabel =
    creative.kind === "display_ad" ? "display" : "video";
  const notes = feedback?.trim();
  const base = `Revise the ${creative.stage} for ${kindLabel} creative "${creative.title}" (id ${creative.id}).`;
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

  if (creative.status === "generating" && hasServiceRole()) {
    try {
      const reconciled = await reconcileCreativeAgainstTrigger(creative);
      return NextResponse.json({ creative: reconciled });
    } catch (err) {
      logServerError("api.creatives.get.reconcile", err, { creativeId: id });
    }
  }

  return NextResponse.json({ creative });
}

export async function DELETE(
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

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  try {
    await deleteCreativeWithJob({
      workspaceId: active.workspace.id,
      creativeId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to delete creative.");
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logServerError("api.creatives.delete", err, { creativeId: id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  if (action === "pause") {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { error: "Jobs service is not configured." },
        { status: 503 },
      );
    }
    try {
      const { creative, job } = await pauseCreativeGeneration({
        workspaceId: active.workspace.id,
        creativeId: id,
      });
      return NextResponse.json({ creative, jobId: job?.id ?? null });
    } catch (err) {
      const message = unknownErrorMessage(err, "Failed to pause.");
      if (message.includes("Only generating")) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      logServerError("api.creatives.pause", err, { creativeId: id });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "resume") {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { error: "Jobs service is not configured." },
        { status: 503 },
      );
    }
    try {
      const { creative, job } = await resumeCreativeGeneration({
        workspaceId: active.workspace.id,
        creativeId: id,
        createdBy: user.id,
      });
      return NextResponse.json({ creative, jobId: job.id });
    } catch (err) {
      const message = unknownErrorMessage(err, "Failed to resume.");
      if (message.includes("Only paused")) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      logServerError("api.creatives.resume", err, { creativeId: id });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

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
      existing.status !== "revising" &&
      existing.status !== "paused"
    ) {
      return NextResponse.json(
        { error: "Only reviewable or paused creatives can be rejected." },
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

  if (action === "resubmit") {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { error: "Jobs service is not configured." },
        { status: 503 },
      );
    }
    if (
      existing.status !== "revising" &&
      existing.status !== "awaiting_review"
    ) {
      return NextResponse.json(
        {
          error:
            "Only revising or awaiting-review creatives can be resubmitted.",
        },
        { status: 409 },
      );
    }
    try {
      const { creative, job } = await resubmitCreativeStage({
        workspaceId: active.workspace.id,
        creativeId: id,
        createdBy: user.id,
        trigger: "api",
        feedback: parsed.data.feedback ?? existing.revisionFeedback ?? undefined,
        brief: parsed.data.brief,
      });
      return NextResponse.json({ creative, jobId: job.id });
    } catch (err) {
      const message = unknownErrorMessage(err, "Failed to resubmit.");
      if (
        message.includes("can no longer") ||
        message.includes("already in progress") ||
        message.includes("Resume the paused")
      ) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      logServerError("api.creatives.resubmit", err, { creativeId: id });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "reopen") {
    try {
      const creative = await reopenCreative({
        workspaceId: active.workspace.id,
        creativeId: id,
      });
      return NextResponse.json({ creative });
    } catch (err) {
      const message = unknownErrorMessage(err, "Failed to reopen.");
      if (message.includes("Only rejected")) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      logServerError("api.creatives.reopen", err, { creativeId: id });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "set_external_ad_refs") {
    const creative = await creatives.update(id, {
      externalAdRefs: parsed.data.externalAdRefs,
    });
    return NextResponse.json({ creative });
  }

  if (action === "update_video_edits") {
    if (!existing.video?.clips?.length) {
      return NextResponse.json(
        { error: "This creative has no editable clips." },
        { status: 409 },
      );
    }
    if (existing.status === "generating") {
      return NextResponse.json(
        { error: "Wait for generation to finish before editing." },
        { status: 409 },
      );
    }
    if (existing.status === "rejected") {
      return NextResponse.json(
        { error: "Reopen the creative before editing." },
        { status: 409 },
      );
    }

    const clips = parsed.data.clips.map((clip) => {
      const source =
        clip.sourceDurationSec ??
        existing.video?.clips.find((c) => c.sceneId === clip.sceneId)
          ?.sourceDurationSec ??
        existing.video?.clips.find((c) => c.sceneId === clip.sceneId)
          ?.durationSec ??
        clip.durationSec;
      const durationSec = Math.min(
        Math.max(0.5, clip.durationSec),
        source,
      );
      return {
        ...clip,
        durationSec,
        sourceDurationSec: source,
        caption: clip.caption ?? "",
      };
    });

    const durationSec = clips.reduce((sum, c) => sum + c.durationSec, 0);
    const video = {
      ...existing.video,
      clips,
      durationSec,
    };

    await creatives.update(id, { video });

    if (parsed.data.reexport !== false) {
      if (!hasServiceRole()) {
        return NextResponse.json(
          { error: "Jobs service is not configured." },
          { status: 503 },
        );
      }
      try {
        const { creative, job } = await enqueueRenderCreativeVideoJob({
          workspaceId: active.workspace.id,
          createdBy: user.id,
          trigger: "api",
          creativeId: id,
        });
        return NextResponse.json({ creative, jobId: job.id });
      } catch (err) {
        const message = unknownErrorMessage(err, "Failed to re-export.");
        logServerError("api.creatives.update_video_edits", err, {
          creativeId: id,
        });
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const creative = await creatives.getById(id);
    return NextResponse.json({ creative: creative ?? existing });
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
      rollbackStage: existing.stage,
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
