import { tasks } from "@trigger.dev/sdk";
import type {
  CreateCampaignJobInput,
  JobRun,
  JobRunTrigger,
} from "@/domain";
import {
  payloadFromCreateCampaignInput,
  runCreateCampaignJob,
} from "@/lib/jobs/create-campaign";
import { hasServiceRole } from "@/lib/supabase/service";
import { getJobWriteRepository } from "@/repositories";
import type { createCampaignTask } from "@/trigger/create-campaign";

export type EnqueueCreateCampaignInput = {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  input: CreateCampaignJobInput;
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
    const message =
      err instanceof Error ? err.message : "Failed to trigger job.";
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    throw err;
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
