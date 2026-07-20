import { task } from "@trigger.dev/sdk";
import {
  runGenerateCreativeStageJob,
  type GenerateCreativeStageJobPayload,
} from "@/lib/jobs/generate-creative-stage";

export const generateCreativeStageTask = task({
  id: "generate-creative-stage",
  // Stub pipeline is sub-second; hang until the global 300s maxDuration hid misconfig.
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: GenerateCreativeStageJobPayload) => {
    return runGenerateCreativeStageJob(payload);
  },
});
