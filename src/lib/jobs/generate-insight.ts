import type { GenerateInsightJobInput } from "@/domain";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import { unknownErrorMessage } from "@/lib/errors";
import { generateInsightContent } from "@/lib/jobs/generate-insight-content";
import { syncDateRange } from "@/lib/performance/date-range";
import {
  getGoalWriteRepository,
  getInsightWriteRepository,
  getJobWriteRepository,
  getPerformanceWriteRepository,
  getProductWriteRepository,
} from "@/repositories";

export type GenerateInsightJobPayload = {
  jobRunId: string;
  workspaceId: string;
  createdBy: string | null;
  insightId: string;
  productId?: string | null;
  goalId?: string | null;
  sourceJobId?: string | null;
  revisionFeedback?: string | null;
};

export function payloadFromGenerateInsightInput(
  jobRunId: string,
  workspaceId: string,
  createdBy: string | null,
  input: GenerateInsightJobInput,
): GenerateInsightJobPayload {
  return {
    jobRunId,
    workspaceId,
    createdBy,
    insightId: input.insightId,
    productId: input.productId ?? null,
    goalId: input.goalId ?? null,
    sourceJobId: input.sourceJobId ?? null,
    revisionFeedback: input.revisionFeedback ?? null,
  };
}

export async function runGenerateInsightJob(
  payload: GenerateInsightJobPayload,
): Promise<{ insightId: string }> {
  assertTriggerJobEnv();

  const jobs = getJobWriteRepository();
  const insights = getInsightWriteRepository();
  const goals = getGoalWriteRepository();
  const products = getProductWriteRepository();
  const performance = getPerformanceWriteRepository();

  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const insight = await insights.getById(payload.insightId);
    if (!insight || insight.workspaceId !== payload.workspaceId) {
      throw new Error("Insight not found in workspace.");
    }

    const productId = payload.productId ?? insight.productId;
    let product = null;
    if (productId) {
      product = await products.getProduct(productId);
      if (!product || product.workspaceId !== payload.workspaceId) {
        throw new Error("Product not found in workspace.");
      }
    }

    const activeGoals = await goals.listActiveByWorkspace(payload.workspaceId);
    let sourceJob = null;
    const sourceJobId =
      payload.sourceJobId ??
      (insight.triggerRef && typeof insight.triggerRef.jobId === "string"
        ? insight.triggerRef.jobId
        : null);
    if (sourceJobId) {
      sourceJob = await jobs.getById(sourceJobId);
    }

    const range = syncDateRange({ backfill: true, lastSyncedAt: null });
    const performanceResult = await performance
      .queryPerformance({
        workspaceId: payload.workspaceId,
        productId,
        startDate: range.startDate,
        endDate: range.endDate,
        groupBy: "campaign",
      })
      .catch(() => null);

    const content = await generateInsightContent({
      goals: activeGoals,
      sourceJob,
      revisionFeedback: payload.revisionFeedback ?? insight.revisionFeedback,
      productId,
      product,
      performance: performanceResult,
      workspaceId: payload.workspaceId,
      userId: payload.createdBy,
    });

    await insights.update(insight.id, {
      title: content.title,
      summary: content.summary,
      rationale: content.rationale,
      kind: content.kind,
      goalId: content.goalId ?? payload.goalId ?? null,
      productId: content.productId ?? productId ?? null,
      action: content.action,
      status: "awaiting_review",
      activeJobId: null,
      revisionFeedback: null,
    });

    const result = { insightId: payload.insightId };
    await jobs.update(payload.jobRunId, {
      status: "succeeded",
      result,
      error: null,
      finishedAt: new Date().toISOString(),
    });
    return result;
  } catch (err) {
    const message = clarifyTriggerSupabaseError(
      unknownErrorMessage(err, "Insight generation failed."),
    );
    await jobs.update(payload.jobRunId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    try {
      await insights.update(payload.insightId, {
        status: "failed",
        activeJobId: null,
      });
    } catch {
      // ignore secondary failure
    }
    throw err;
  }
}
