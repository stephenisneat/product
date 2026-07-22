import { tasks } from "@trigger.dev/sdk";
import type { JobRun, JobRunTrigger, SyncAdPerformanceJobInput } from "@/domain";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import {
  payloadFromSyncAdPerformanceInput,
  runSyncAdPerformanceJob,
} from "@/lib/jobs/sync-ad-performance";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getAdConnectionWriteRepository,
  getJobWriteRepository,
} from "@/repositories";
import type { syncAdPerformanceTask } from "@/trigger/sync-ad-performance";

function hasTriggerSecret(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export type EnqueueSyncAdPerformanceInput = {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  input: SyncAdPerformanceJobInput;
};

export async function enqueueSyncAdPerformanceJob(
  opts: EnqueueSyncAdPerformanceInput,
): Promise<JobRun> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  const jobs = getJobWriteRepository();
  const run = await jobs.create({
    workspaceId: opts.workspaceId,
    productId: null,
    type: "sync_ad_performance",
    trigger: opts.trigger,
    createdBy: opts.createdBy,
    input: opts.input,
  });

  const payload = payloadFromSyncAdPerformanceInput(
    run.id,
    opts.workspaceId,
    opts.createdBy,
    opts.input,
  );

  if (!hasTriggerSecret()) {
    void runSyncAdPerformanceJob(payload).catch((error) => {
      logServerError("sync-ad-performance:in-process", error);
    });
    return run;
  }

  try {
    const handle = await tasks.trigger<typeof syncAdPerformanceTask>(
      "sync-ad-performance",
      payload,
    );
    await jobs.update(run.id, { triggerRunId: handle.id });
  } catch (error) {
    logServerError("sync-ad-performance:trigger", error);
    await jobs.update(run.id, {
      status: "failed",
      error: unknownErrorMessage(error),
      finishedAt: new Date().toISOString(),
    });
  }

  return run;
}

/** Cron fan-out: enqueue one sync job per active ad connection with an account. */
export async function enqueueAdPerformanceSyncForAllConnections(opts?: {
  backfill?: boolean;
  createdBy?: string | null;
  trigger?: JobRunTrigger;
}): Promise<{ enqueued: number; connectionIds: string[] }> {
  if (!hasServiceRole()) {
    return { enqueued: 0, connectionIds: [] };
  }

  const connections = getAdConnectionWriteRepository();
  const list = await connections.listAllActiveWithAccount();
  const connectionIds: string[] = [];

  for (const connection of list) {
    await enqueueSyncAdPerformanceJob({
      workspaceId: connection.workspaceId,
      createdBy: opts?.createdBy ?? null,
      trigger: opts?.trigger ?? "cron",
      input: {
        connectionId: connection.id,
        backfill: opts?.backfill,
      },
    });
    connectionIds.push(connection.id);
  }

  return { enqueued: connectionIds.length, connectionIds };
}
