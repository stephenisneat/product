import { task } from "@trigger.dev/sdk";
import {
  runCreateCampaignJob,
  type CreateCampaignJobPayload,
} from "@/lib/jobs/create-campaign";

export const createCampaignTask = task({
  id: "create-campaign",
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: CreateCampaignJobPayload) => {
    return runCreateCampaignJob(payload);
  },
});
