import { task } from "@trigger.dev/sdk";
import { applyCreativeJobCanceled } from "@/lib/jobs/creative-job-controls";
import {
  runGenerateCreativeStageJob,
  type GenerateCreativeStageJobPayload,
} from "@/lib/jobs/generate-creative-stage";
import { logServerError } from "@/lib/errors";

export const generateCreativeStageTask = task({
  id: "generate-creative-stage",
  // Screenplay/world/storyboard are quicker; video runs Veo per scene + Remotion stitch.
  maxDuration: 1200,
  // Remotion Chrome + multi-clip stitch needs more than the default small machine.
  machine: "large-1x",
  retry: {
    maxAttempts: 3,
    outOfMemory: {
      machine: "large-2x",
    },
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
