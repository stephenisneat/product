import { tasks } from "@trigger.dev/sdk";
import type {
  CreateCampaignJobInput,
  Creative,
  CreativeStage,
  GenerateCreativeStageJobInput,
  JobRun,
  JobRunTrigger,
  WorkspacePlan,
} from "@/domain";
import {
  PlanEntitlementError,
} from "@/lib/billing/gates";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import {
  assertCanLinkCreativesToCampaigns,
  normalizeCampaignIds,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import {
  payloadFromCreateCampaignInput,
  runCreateCampaignJob,
} from "@/lib/jobs/create-campaign";
import { jobTypeForStage } from "@/lib/jobs/creative-stubs";
import { payloadFromGenerateCreativeStageInput } from "@/lib/jobs/generate-creative-stage-payload";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
} from "@/repositories";
import type { createCampaignTask } from "@/trigger/create-campaign";
import type { generateCreativeStageTask } from "@/trigger/generate-creative-stage";
import type { renderCreativeVideoTask } from "@/trigger/render-creative-video";

export type EnqueueCreateCampaignInput = {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  input: CreateCampaignJobInput;
};

export type EnqueueGenerateCreativeStageInput = {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  input: GenerateCreativeStageJobInput;
  /**
   * Stage to restore when parking after a failed enqueue that already
   * advanced the creative (Accept → next stage). Omit when the creative
   * should stay on its current stage (create / resume / resubmit).
   */
  rollbackStage?: CreativeStage;
};

/** Patch applied when Trigger/enqueue fails before or after advancing stage. */
export function creativePatchAfterEnqueueFailure(opts: {
  rollbackStage?: CreativeStage;
}): {
  status: "paused";
  activeJobId: null;
  stage?: CreativeStage;
} {
  const patch: {
    status: "paused";
    activeJobId: null;
    stage?: CreativeStage;
  } = {
    status: "paused",
    activeJobId: null,
  };
  if (opts.rollbackStage) {
    patch.stage = opts.rollbackStage;
  }
  return patch;
}

export type StartVideoCreativeInput = {
  workspaceId: string;
  productId: string;
  /** @deprecated Prefer campaignIds */
  campaignId?: string | null;
  campaignIds?: string[];
  title: string;
  brief: string;
  createdBy: string;
  trigger: JobRunTrigger;
  plan: WorkspacePlan;
};

function hasTriggerSecret(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

/**
 * Insert a pending job_run and start the create_campaign task.
 * Without TRIGGER_SECRET_KEY (local/dev), runs the job inline.
 */
export async function enqueueCreateCampaignJob(
  opts: EnqueueCreateCampaignInput,
): Promise<JobRun> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  const jobs = getJobWriteRepository();
  const run = await jobs.create({
    workspaceId: opts.workspaceId,
    productId: opts.input.productId,
    type: "create_campaign",
    trigger: opts.trigger,
    createdBy: opts.createdBy,
    input: opts.input,
  });

  const payload = payloadFromCreateCampaignInput(
    run.id,
    opts.workspaceId,
    opts.createdBy,
    opts.input,
  );

  if (!hasTriggerSecret()) {
    // Dev fallback when Trigger.dev is not configured.
    void runCreateCampaignJob(payload).catch(() => {
      // Status is updated inside runCreateCampaignJob.
    });
    return run;
  }

  try {
    const handle = await tasks.trigger<typeof createCampaignTask>(
      "create-campaign",
      payload,
    );
    return jobs.update(run.id, { triggerRunId: handle.id });
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to trigger job.");
    logServerError("enqueueCreateCampaignJob.trigger", err, {
      jobRunId: run.id,
      workspaceId: opts.workspaceId,
    });
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    throw new Error(message, { cause: err });
  }
}

/**
 * Scaffold for domain-event driven jobs (unused until scrape/pacing).
 */
export async function enqueueJobFromEvent(
  opts: EnqueueCreateCampaignInput,
): Promise<JobRun> {
  return enqueueCreateCampaignJob({
    ...opts,
    trigger: "event",
  });
}

export async function enqueueGenerateCreativeStageJob(
  opts: EnqueueGenerateCreativeStageInput,
): Promise<JobRun> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();
  const stage = opts.input.stage;
  const run = await jobs.create({
    workspaceId: opts.workspaceId,
    productId: opts.input.productId,
    type: jobTypeForStage(stage),
    trigger: opts.trigger,
    createdBy: opts.createdBy,
    input: opts.input,
  });

  const payload = payloadFromGenerateCreativeStageInput(
    run.id,
    opts.workspaceId,
    opts.createdBy,
    opts.input,
  );

  const markGenerating = () =>
    creatives.update(opts.input.creativeId, {
      stage,
      status: "generating",
      activeJobId: run.id,
    });

  const parkFailure = async (message: string) => {
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    await creatives.update(
      opts.input.creativeId,
      creativePatchAfterEnqueueFailure({
        rollbackStage: opts.rollbackStage,
      }),
    );
  };

  if (!hasTriggerSecret()) {
    // Remotion (@remotion/bundler → @rspack/binding) cannot load on Vercel
    // serverless. Keep the job runner out of that graph entirely: on Vercel
    // require Trigger; locally, dynamic-import the runner for inline fallback.
    // `process.env.VERCEL` is inlined at build time so the import is tree-shaken
    // out of production bundles.
    if (process.env.VERCEL) {
      const message =
        "TRIGGER_SECRET_KEY is required to generate creatives on Vercel.";
      await parkFailure(message);
      throw new Error(message);
    }

    await markGenerating();
    void import("@/lib/jobs/generate-creative-stage")
      .then(({ runGenerateCreativeStageJob }) =>
        runGenerateCreativeStageJob(payload),
      )
      .catch(() => {
        // Status is updated inside the job runner.
      });
    return run;
  }

  try {
    const handle = await tasks.trigger<typeof generateCreativeStageTask>(
      "generate-creative-stage",
      payload,
    );
    // Advance stage only after Trigger accepts the run so Accept→next
    // failures never leave an empty awaiting_review stage.
    await markGenerating();
    return jobs.update(run.id, { triggerRunId: handle.id });
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to trigger job.");
    logServerError("enqueueGenerateCreativeStageJob.trigger", err, {
      jobRunId: run.id,
      workspaceId: opts.workspaceId,
      creativeId: opts.input.creativeId,
      stage: opts.input.stage,
      hasTriggerSecret: hasTriggerSecret(),
    });
    await parkFailure(message);
    throw new Error(message, { cause: err });
  }
}

/** Create a video creative and enqueue screenplay generation. */
export async function startVideoCreative(
  opts: StartVideoCreativeInput,
): Promise<{ creative: Creative; job: JobRun }> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to start creatives.",
    );
  }

  const creatives = getCreativeWriteRepository();
  const campaignIds = await resolveProductCampaignIds(
    opts.productId,
    normalizeCampaignIds({
      campaignIds: opts.campaignIds,
      campaignId: opts.campaignId,
    }),
  );

  await assertCanLinkCreativesToCampaigns({
    plan: opts.plan,
    campaignIds,
    countByCampaign: (id) => creatives.countByCampaign(id),
  });

  const creative = await creatives.create({
    workspaceId: opts.workspaceId,
    productId: opts.productId,
    campaignIds,
    title: opts.title,
    brief: opts.brief,
    stage: "screenplay",
    status: "generating",
    createdBy: opts.createdBy,
  });

  try {
    const job = await enqueueGenerateCreativeStageJob({
      workspaceId: opts.workspaceId,
      createdBy: opts.createdBy,
      trigger: opts.trigger,
      input: {
        creativeId: creative.id,
        productId: opts.productId,
        stage: "screenplay",
      },
    });
    const refreshed = await creatives.getById(creative.id);
    return { creative: refreshed ?? creative, job };
  } catch (err) {
    if (err instanceof PlanEntitlementError) throw err;
    const message = unknownErrorMessage(err, "Failed to start video creative.");
    logServerError("startVideoCreative", err, {
      creativeId: creative.id,
      workspaceId: opts.workspaceId,
      productId: opts.productId,
      plan: opts.plan,
      hasTriggerSecret: hasTriggerSecret(),
    });
    await creatives.update(creative.id, {
      status: "paused",
      activeJobId: null,
    });
    throw new Error(message, { cause: err });
  }
}

/** Re-run generation for the creative's current stage (revise → resubmit). */
export async function resubmitCreativeStage(opts: {
  workspaceId: string;
  creativeId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  brief?: string;
  feedback?: string;
}): Promise<{ creative: Creative; job: JobRun }> {
  const creatives = getCreativeWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }
  if (creative.status === "rejected" || creative.status === "ready") {
    throw new Error("This creative can no longer be revised.");
  }
  if (creative.status === "generating") {
    throw new Error("Generation is already in progress.");
  }
  if (creative.status === "paused") {
    throw new Error("Resume the paused creative instead of revising.");
  }

  const stage: CreativeStage = creative.stage;
  const patch: {
    brief?: string;
    revisionFeedback?: string | null;
  } = {};
  if (opts.brief?.trim()) patch.brief = opts.brief.trim();
  if (opts.feedback !== undefined) {
    patch.revisionFeedback = opts.feedback.trim() || null;
  }

  // Persist feedback/brief first; status advances to generating only after
  // enqueue succeeds so a Trigger failure parks as paused, not stuck generating.
  if (Object.keys(patch).length > 0) {
    await creatives.update(creative.id, patch);
  }

  const job = await enqueueGenerateCreativeStageJob({
    workspaceId: opts.workspaceId,
    createdBy: opts.createdBy,
    trigger: opts.trigger,
    input: {
      creativeId: creative.id,
      productId: creative.productId,
      stage,
    },
  });

  const refreshed = await creatives.getById(creative.id);
  return { creative: refreshed ?? creative, job };
}

/** Reopen a rejected creative so it can be resumed or resubmitted. */
export async function reopenCreative(opts: {
  workspaceId: string;
  creativeId: string;
}): Promise<Creative> {
  const creatives = getCreativeWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }
  if (creative.status !== "rejected") {
    throw new Error("Only rejected creatives can be reopened.");
  }
  return creatives.update(creative.id, {
    status: "paused",
    activeJobId: null,
  });
}

/** Persist clip edits and enqueue a Remotion re-export. */
export async function enqueueRenderCreativeVideoJob(opts: {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  creativeId: string;
}): Promise<{ creative: Creative; job: JobRun }> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  const creatives = getCreativeWriteRepository();
  const jobs = getJobWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }
  if (!creative.video?.clips?.length) {
    throw new Error("This creative has no editable clips.");
  }
  if (creative.status === "generating") {
    throw new Error("Generation is already in progress.");
  }
  if (creative.status === "rejected") {
    throw new Error("Reopen the creative before re-exporting.");
  }

  const run = await jobs.create({
    workspaceId: opts.workspaceId,
    productId: creative.productId,
    type: "render_creative_video",
    trigger: opts.trigger,
    createdBy: opts.createdBy,
    input: {
      creativeId: creative.id,
      productId: creative.productId,
    },
  });

  const payload = {
    jobRunId: run.id,
    workspaceId: opts.workspaceId,
    createdBy: opts.createdBy,
    creativeId: creative.id,
    productId: creative.productId,
  };

  const parkFailure = async (message: string) => {
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    await creatives.update(creative.id, {
      status: "paused",
      activeJobId: null,
    });
  };

  if (!hasTriggerSecret()) {
    if (process.env.VERCEL) {
      const message =
        "TRIGGER_SECRET_KEY is required to re-render creatives on Vercel.";
      await parkFailure(message);
      throw new Error(message);
    }

    await creatives.update(creative.id, {
      status: "generating",
      activeJobId: run.id,
    });
    void import("@/lib/jobs/render-creative-video-job")
      .then(({ runRenderCreativeVideoJob }) =>
        runRenderCreativeVideoJob(payload),
      )
      .catch(() => {
        // Status updated inside the job runner.
      });
    const refreshed = await creatives.getById(creative.id);
    return { creative: refreshed ?? creative, job: run };
  }

  try {
    const handle = await tasks.trigger<typeof renderCreativeVideoTask>(
      "render-creative-video",
      payload,
    );
    await creatives.update(creative.id, {
      status: "generating",
      activeJobId: run.id,
    });
    const job = await jobs.update(run.id, { triggerRunId: handle.id });
    const refreshed = await creatives.getById(creative.id);
    return { creative: refreshed ?? creative, job };
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to trigger re-render.");
    logServerError("enqueueRenderCreativeVideoJob.trigger", err, {
      jobRunId: run.id,
      creativeId: creative.id,
    });
    await parkFailure(message);
    throw new Error(message, { cause: err });
  }
}
