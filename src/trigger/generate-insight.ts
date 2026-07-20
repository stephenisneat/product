import { task } from "@trigger.dev/sdk";
import {
  runGenerateInsightJob,
  type GenerateInsightJobPayload,
} from "@/lib/jobs/generate-insight";

export const generateInsightTask = task({
  id: "generate-insight",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: GenerateInsightJobPayload) => {
    return runGenerateInsightJob(payload);
  },
});
