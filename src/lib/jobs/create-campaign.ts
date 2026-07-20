import type { CreateCampaignJobInput } from "@/domain";
import {
  PlanEntitlementError,
  assertCanCreateCampaign,
} from "@/lib/billing/gates";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import { unknownErrorMessage } from "@/lib/errors";
import {
  getJobWriteRepository,
  getProductWriteRepository,
  getWorkspaceWriteRepository,
} from "@/repositories";

export type CreateCampaignJobPayload = {
  jobRunId: string;
  workspaceId: string;
  productId: string;
  createdBy: string | null;
  name: string;
  objective?: string;
  channels?: string[];
};

export function payloadFromCreateCampaignInput(
  jobRunId: string,
  workspaceId: string,
  createdBy: string | null,
  input: CreateCampaignJobInput,
): CreateCampaignJobPayload {
  return {
    jobRunId,
    workspaceId,
    productId: input.productId,
    createdBy,
    name: input.name,
    objective: input.objective,
    channels: input.channels,
  };
}

export async function runCreateCampaignJob(
  payload: CreateCampaignJobPayload,
): Promise<{ campaignId: string }> {
  assertTriggerJobEnv();

  const jobs = getJobWriteRepository();
  const products = getProductWriteRepository();
  const workspaces = getWorkspaceWriteRepository();

  const startedAt = new Date().toISOString();
  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt,
  });

  try {
    const product = await products.getProduct(payload.productId);
    if (!product || product.workspaceId !== payload.workspaceId) {
      throw new Error("Product not found in workspace.");
    }

    const workspace = await workspaces.getWorkspace(payload.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    const plan = workspace.plan ?? "free";
    const existing = await products.listCampaigns(payload.productId);
    assertCanCreateCampaign(plan, existing.length);

    const now = new Date().toISOString();
    const campaign = await products.createCampaign({
      id: crypto.randomUUID(),
      productId: payload.productId,
      name: payload.name,
      status: "draft",
      channels: payload.channels ?? [],
      objective: payload.objective ?? "",
      updatedAt: now,
    });

    const result = { campaignId: campaign.id };
    await jobs.update(payload.jobRunId, {
      status: "succeeded",
      result,
      error: null,
      finishedAt: new Date().toISOString(),
    });

    const finished = await jobs.getById(payload.jobRunId);
    if (finished) {
      const { maybeEnqueueInsightAfterJob } = await import(
        "@/lib/jobs/enqueue-insight"
      );
      void maybeEnqueueInsightAfterJob({
        workspaceId: payload.workspaceId,
        job: finished,
        createdBy: payload.createdBy,
      });
    }

    return result;
  } catch (err) {
    const message =
      err instanceof PlanEntitlementError
        ? err.message
        : clarifyTriggerSupabaseError(
            unknownErrorMessage(err, "Campaign job failed."),
          );
    await jobs.update(payload.jobRunId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });

    const finished = await jobs.getById(payload.jobRunId);
    if (finished) {
      const { maybeEnqueueInsightAfterJob } = await import(
        "@/lib/jobs/enqueue-insight"
      );
      void maybeEnqueueInsightAfterJob({
        workspaceId: payload.workspaceId,
        job: finished,
        createdBy: payload.createdBy,
      });
    }

    throw err;
  }
}
