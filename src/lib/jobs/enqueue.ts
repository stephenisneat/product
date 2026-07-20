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
  assertCanCreateCreative,
} from "@/lib/billing/gates";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import {
  payloadFromCreateCampaignInput,
  runCreateCampaignJob,
} from "@/lib/jobs/create-campaign";
import { jobTypeForStage } from "@/lib/jobs/creative-stubs";
import {
  payloadFromGenerateCreativeStageInput,
  runGenerateCreativeStageJob,
} from "@/lib/jobs/generate-creative-stage";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
} from "@/repositories";
import type { createCampaignTask } from "@/trigger/create-campaign";
import type { generateCreativeStageTask } from "@/trigger/generate-creative-stage";

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
};

export type StartVideoCreativeInput = {
  workspaceId: string;
  productId: string;
  campaignId?: string | null;
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

  await creatives.update(opts.input.creativeId, {
    stage,
    status: "generating",
    activeJobId: run.id,
  });

  const payload = payloadFromGenerateCreativeStageInput(
    run.id,
    opts.workspaceId,
    opts.createdBy,
    opts.input,
  );

  if (!hasTriggerSecret()) {
    void runGenerateCreativeStageJob(payload).catch(() => {
      // Status is updated inside the job runner.
    });
    return run;
  }

  try {
    const handle = await tasks.trigger<typeof generateCreativeStageTask>(
      "generate-creative-stage",
      payload,
    );
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
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    await creatives.update(opts.input.creativeId, {
      status: "awaiting_review",
      activeJobId: null,
    });
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

  if (opts.campaignId) {
    const count = await creatives.countByCampaign(opts.campaignId);
    assertCanCreateCreative(opts.plan, count);
  } else {
    assertCanCreateCreative(opts.plan, 0);
  }

  const creative = await creatives.create({
    workspaceId: opts.workspaceId,
    productId: opts.productId,
    campaignId: opts.campaignId ?? null,
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
      status: "rejected",
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

  const stage: CreativeStage = creative.stage;
  const patch: {
    brief?: string;
    revisionFeedback?: string | null;
    status: "generating";
  } = { status: "generating" };
  if (opts.brief?.trim()) patch.brief = opts.brief.trim();
  if (opts.feedback !== undefined) {
    patch.revisionFeedback = opts.feedback.trim() || null;
  }

  await creatives.update(creative.id, patch);

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
