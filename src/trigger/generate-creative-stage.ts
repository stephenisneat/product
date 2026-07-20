import { task } from "@trigger.dev/sdk";
import { applyCreativeJobCanceled } from "@/lib/jobs/creative-job-controls";
import {
  runGenerateCreativeStageJob,
  type GenerateCreativeStageJobPayload,
} from "@/lib/jobs/generate-creative-stage";
import { logServerError } from "@/lib/errors";

export const generateCreativeStageTask = task({
  id: "generate-creative-stage",
  // Screenplay is quick; storyboard runs multiple image generations.
  maxDuration: 480,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: GenerateCreativeStageJobPayload) => {
    return runGenerateCreativeStageJob(payload);
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
      logServerError("generate-creative-stage.onCancel", err, {
        jobRunId: payload.jobRunId,
        creativeId: payload.creativeId,
      });
    }
  },
});
