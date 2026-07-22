import { task } from "@trigger.dev/sdk";
import { applyCreativeJobCanceled } from "@/lib/jobs/creative-job-controls";
import {
  runRenderCreativeVideoJob,
  type RenderCreativeVideoJobPayload,
} from "@/lib/jobs/render-creative-video-job";
import { logServerError } from "@/lib/errors";

export const renderCreativeVideoTask = task({
  id: "render-creative-video",
  maxDuration: 600,
  machine: "large-1x",
  retry: {
    maxAttempts: 2,
    outOfMemory: {
      machine: "large-2x",
    },
  },
  run: async (payload: RenderCreativeVideoJobPayload) => {
    return runRenderCreativeVideoJob(payload);
  },
  onCancel: async ({ payload }) => {
    try {
      await applyCreativeJobCanceled({
        jobRunId: payload.jobRunId,
        creativeId: payload.creativeId,
        reason: "Canceled on Trigger.dev",
        onlyIfGenerating: true,
      });
    } catch (err) {
      logServerError("render-creative-video.onCancel", err, {
        jobRunId: payload.jobRunId,
        creativeId: payload.creativeId,
      });
    }
  },
});
