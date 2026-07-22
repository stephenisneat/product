import { task } from "@trigger.dev/sdk";
import {
  runSyncAdPerformanceJob,
  type SyncAdPerformanceJobPayload,
} from "@/lib/jobs/sync-ad-performance";

export const syncAdPerformanceTask = task({
  id: "sync-ad-performance",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: SyncAdPerformanceJobPayload) => {
    return runSyncAdPerformanceJob(payload);
  },
});
