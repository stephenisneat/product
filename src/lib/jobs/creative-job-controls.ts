import { runs } from "@trigger.dev/sdk";
import type { Creative, JobRun, JobRunStatus } from "@/domain";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { enqueueGenerateCreativeStageJob } from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
} from "@/repositories";

const TRIGGER_TERMINAL_CANCELED = new Set([
  "CANCELED",
  "EXPIRED",
  "TIMED_OUT",
]);

const TRIGGER_TERMINAL_FAILED = new Set([
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
]);

function hasTriggerSecret(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

/** True when the job is already finished and should not be overwritten. */
export function isJobTerminal(status: JobRunStatus): boolean {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "canceled"
  );
}

/**
 * Mark a creative generation job canceled and park the creative as paused
 * (unless it already left generating).
 */
export async function applyCreativeJobCanceled(opts: {
  jobRunId: string;
  creativeId: string;
  reason?: string;
  /** When true, leave creative status alone if it is no longer generating. */
  onlyIfGenerating?: boolean;
}): Promise<{ job: JobRun; creative: Creative | null }> {
  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();

  const existingJob = await jobs.getById(opts.jobRunId);
  let job = existingJob;
  if (existingJob && !isJobTerminal(existingJob.status)) {
    job = await jobs.update(opts.jobRunId, {
      status: "canceled",
      error: opts.reason ?? existingJob.error ?? "Canceled",
      finishedAt: new Date().toISOString(),
    });
  } else if (!existingJob) {
    throw new Error("Job not found.");
  }

  const creative = await creatives.getById(opts.creativeId);
  if (!creative) {
    return { job: job!, creative: null };
  }

  if (opts.onlyIfGenerating && creative.status !== "generating") {
    return { job: job!, creative };
  }

  if (
    creative.status === "generating" ||
    creative.activeJobId === opts.jobRunId
  ) {
    const updated = await creatives.update(opts.creativeId, {
      status: "paused",
      activeJobId: null,
    });
    return { job: job!, creative: updated };
  }

  return { job: job!, creative };
}

async function cancelTriggerRunIfNeeded(
  triggerRunId: string | null | undefined,
): Promise<void> {
  if (!triggerRunId || !hasTriggerSecret()) return;
  try {
    await runs.cancel(triggerRunId);
  } catch (err) {
    // Already finished / unknown run — platform state is still updated.
    logServerError("cancelTriggerRunIfNeeded", err, { triggerRunId });
  }
}

export async function pauseCreativeGeneration(opts: {
  workspaceId: string;
  creativeId: string;
}): Promise<{ creative: Creative; job: JobRun | null }> {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to pause jobs.");
  }

  const creatives = getCreativeWriteRepository();
  const jobs = getJobWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }
  if (creative.status !== "generating") {
    throw new Error("Only generating creatives can be paused.");
  }

  const job = creative.activeJobId
    ? await jobs.getById(creative.activeJobId)
    : null;

  if (job?.triggerRunId) {
    await cancelTriggerRunIfNeeded(job.triggerRunId);
  }

  if (job) {
    const applied = await applyCreativeJobCanceled({
      jobRunId: job.id,
      creativeId: creative.id,
      reason: "Paused by user",
    });
    return {
      creative: applied.creative ?? creative,
      job: applied.job,
    };
  }

  const updated = await creatives.update(creative.id, {
    status: "paused",
    activeJobId: null,
  });
  return { creative: updated, job: null };
}

export async function resumeCreativeGeneration(opts: {
  workspaceId: string;
  creativeId: string;
  createdBy: string | null;
}): Promise<{ creative: Creative; job: JobRun }> {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to resume jobs.");
  }

  const creatives = getCreativeWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }
  if (creative.status !== "paused") {
    throw new Error("Only paused creatives can be resumed.");
  }

  const job = await enqueueGenerateCreativeStageJob({
    workspaceId: opts.workspaceId,
    createdBy: opts.createdBy,
    trigger: "api",
    input: {
      creativeId: creative.id,
      productId: creative.productId,
      stage: creative.stage,
    },
  });

  const refreshed = await creatives.getById(creative.id);
  return { creative: refreshed ?? creative, job };
}

export async function deleteCreativeWithJob(opts: {
  workspaceId: string;
  creativeId: string;
}): Promise<void> {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to delete creatives.");
  }

  const creatives = getCreativeWriteRepository();
  const jobs = getJobWriteRepository();
  const creative = await creatives.getById(opts.creativeId);
  if (!creative || creative.workspaceId !== opts.workspaceId) {
    throw new Error("Creative not found in workspace.");
  }

  // Cancel every in-flight Trigger run for this creative (not only activeJobId),
  // so the platform hard-delete cannot leave orphaned workers.
  const activeJobs = await jobs.listNonTerminalForCreative(
    opts.workspaceId,
    opts.creativeId,
  );
  const jobsById = new Map(activeJobs.map((job) => [job.id, job]));
  if (creative.activeJobId && !jobsById.has(creative.activeJobId)) {
    const active = await jobs.getById(creative.activeJobId);
    if (active && !isJobTerminal(active.status)) {
      jobsById.set(active.id, active);
    }
  }

  await Promise.all(
    [...jobsById.values()].map(async (job) => {
      await cancelTriggerRunIfNeeded(job.triggerRunId);
      if (!isJobTerminal(job.status)) {
        await jobs.update(job.id, {
          status: "canceled",
          error: "Creative deleted",
          finishedAt: new Date().toISOString(),
        });
      }
    }),
  );

  // Clear FK before delete in case on-delete is set null and race with job.
  if (creative.activeJobId) {
    await creatives.update(creative.id, { activeJobId: null });
  }

  await creatives.delete(creative.id);
}

/**
 * Cancel a job run from the jobs UI. If it is a creative stage job, pause
 * the linked creative when it is still generating.
 */
export async function cancelJobRun(opts: {
  workspaceId: string;
  jobRunId: string;
  reason?: string;
}): Promise<{ job: JobRun; creative: Creative | null }> {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to cancel jobs.");
  }

  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();
  const job = await jobs.getById(opts.jobRunId);
  if (!job || job.workspaceId !== opts.workspaceId) {
    throw new Error("Job not found in workspace.");
  }
  if (isJobTerminal(job.status)) {
    return { job, creative: null };
  }

  await cancelTriggerRunIfNeeded(job.triggerRunId);

  const creativeId =
    typeof job.input.creativeId === "string" ? job.input.creativeId : null;

  if (
    creativeId &&
    (job.type === "generate_creative_screenplay" ||
      job.type === "generate_creative_storyboard" ||
      job.type === "generate_creative_video")
  ) {
    return applyCreativeJobCanceled({
      jobRunId: job.id,
      creativeId,
      reason: opts.reason ?? "Canceled by user",
    });
  }

  const updated = await jobs.update(job.id, {
    status: "canceled",
    error: opts.reason ?? "Canceled by user",
    finishedAt: new Date().toISOString(),
  });

  if (creativeId) {
    const creative = await creatives.getById(creativeId);
    if (creative?.activeJobId === job.id && creative.status === "generating") {
      const paused = await creatives.update(creativeId, {
        status: "paused",
        activeJobId: null,
      });
      return { job: updated, creative: paused };
    }
  }

  return { job: updated, creative: null };
}

/**
 * If Trigger.dev already finished the run but the platform still shows
 * generating, sync job + creative status.
 */
export async function reconcileCreativeAgainstTrigger(
  creative: Creative,
): Promise<Creative> {
  if (creative.status !== "generating" || !creative.activeJobId) {
    return creative;
  }
  if (!hasTriggerSecret() || !hasServiceRole()) {
    return creative;
  }

  const jobs = getJobWriteRepository();
  const job = await jobs.getById(creative.activeJobId);
  if (!job) {
    return getCreativeWriteRepository().update(creative.id, {
      status: "paused",
      activeJobId: null,
    });
  }

  if (isJobTerminal(job.status)) {
    if (job.status === "succeeded") {
      // Worker should have cleared generating; heal stuck row.
      return getCreativeWriteRepository().update(creative.id, {
        status: "awaiting_review",
        activeJobId: null,
      });
    }
    // failed or canceled — park the creative without rewriting job status.
    return getCreativeWriteRepository().update(creative.id, {
      status: "paused",
      activeJobId: null,
    });
  }

  if (!job.triggerRunId) {
    return creative;
  }

  try {
    const run = await runs.retrieve(job.triggerRunId);
    if (run.isCancelled || TRIGGER_TERMINAL_CANCELED.has(run.status)) {
      const applied = await applyCreativeJobCanceled({
        jobRunId: job.id,
        creativeId: creative.id,
        reason: `Trigger run ${run.status.toLowerCase()}`,
        onlyIfGenerating: true,
      });
      return applied.creative ?? creative;
    }
    if (run.isFailed || TRIGGER_TERMINAL_FAILED.has(run.status)) {
      if (!isJobTerminal(job.status)) {
        await jobs.update(job.id, {
          status: "failed",
          error: `Trigger run ${run.status.toLowerCase()}`,
          finishedAt: new Date().toISOString(),
        });
      }
      return getCreativeWriteRepository().update(creative.id, {
        status: "paused",
        activeJobId: null,
      });
    }
  } catch (err) {
    logServerError("reconcileCreativeAgainstTrigger", err, {
      creativeId: creative.id,
      jobRunId: job.id,
      triggerRunId: job.triggerRunId,
      message: unknownErrorMessage(err, "retrieve failed"),
    });
  }

  return creative;
}

export async function reconcileCreativesAgainstTrigger(
  creatives: Creative[],
): Promise<Creative[]> {
  const generating = creatives.filter((c) => c.status === "generating");
  if (generating.length === 0) return creatives;

  const updatedById = new Map<string, Creative>();
  await Promise.all(
    generating.map(async (creative) => {
      const next = await reconcileCreativeAgainstTrigger(creative);
      if (next !== creative) updatedById.set(creative.id, next);
    }),
  );

  if (updatedById.size === 0) return creatives;
  return creatives.map((c) => updatedById.get(c.id) ?? c);
}
