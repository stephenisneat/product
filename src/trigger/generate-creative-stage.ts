import { task } from "@trigger.dev/sdk";
import {
  runGenerateCreativeStageJob,
  type GenerateCreativeStageJobPayload,
} from "@/lib/jobs/generate-creative-stage";

export const generateCreativeStageTask = task({
  id: "generate-creative-stage",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: GenerateCreativeStageJobPayload) => {
    return runGenerateCreativeStageJob(payload);
  },
});
