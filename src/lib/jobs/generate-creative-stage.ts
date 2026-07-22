import type { CreativeStage } from "@/domain";
import { unknownErrorMessage } from "@/lib/errors";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import {
  generateScreenplay,
  generateStoryboard,
} from "@/lib/jobs/generate-creative-content";
import {
  generateDisplayAssets,
  generateDisplayConcept,
} from "@/lib/jobs/generate-display-creative-content";
import {
  generateSearchCopy,
  generateSearchKeywords,
} from "@/lib/jobs/generate-search-creative-content";
import { generateVideo } from "@/lib/jobs/generate-creative-video";
import type { GenerateCreativeStageJobPayload } from "@/lib/jobs/generate-creative-stage-payload";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
  getProductWriteRepository,
} from "@/repositories";

export type { GenerateCreativeStageJobPayload } from "@/lib/jobs/generate-creative-stage-payload";

async function wasCanceled(jobRunId: string): Promise<boolean> {
  const jobs = getJobWriteRepository();
  const job = await jobs.getById(jobRunId);
  return job?.status === "canceled";
}

export async function runGenerateCreativeStageJob(
  payload: GenerateCreativeStageJobPayload,
): Promise<{ creativeId: string; stage: CreativeStage } | null> {
  assertTriggerJobEnv();

  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();
  const products = getProductWriteRepository();

  const existing = await jobs.getById(payload.jobRunId);
  // Canceled wins; allow retries after a prior failed attempt.
  if (existing?.status === "canceled" || existing?.status === "succeeded") {
    return null;
  }

  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt: existing?.startedAt ?? new Date().toISOString(),
  });

  const existingCreative = await creatives.getById(payload.creativeId);
  if (
    !existingCreative ||
    existingCreative.workspaceId !== payload.workspaceId
  ) {
    // Soft-exit when the creative was hard-deleted while this run was queued.
    await jobs.update(payload.jobRunId, {
      status: "canceled",
      error: "Creative deleted",
      finishedAt: new Date().toISOString(),
    });
    return null;
  }

  // Heal pause/fail side-effects if Trigger retries this attempt.
  await creatives.update(payload.creativeId, {
    status: "generating",
    activeJobId: payload.jobRunId,
  });

  try {
    if (await wasCanceled(payload.jobRunId)) {
      return null;
    }

    const creative = await creatives.getById(payload.creativeId);
    if (!creative || creative.workspaceId !== payload.workspaceId) {
      await jobs.update(payload.jobRunId, {
        status: "canceled",
        error: "Creative deleted",
        finishedAt: new Date().toISOString(),
      });
      return null;
    }

    const product = await products.getProduct(payload.productId);
    if (!product || product.workspaceId !== payload.workspaceId) {
      throw new Error("Product not found in workspace.");
    }

    if (await wasCanceled(payload.jobRunId)) {
      return null;
    }

    const feedback = creative.revisionFeedback?.trim() || "";
    const briefForGen = feedback
      ? `${creative.brief}\n\nRevision notes: ${feedback}`
      : creative.brief;

    if (payload.stage === "screenplay") {
      const screenplay = await generateScreenplay({
        brief: briefForGen,
        product,
        workspaceId: payload.workspaceId,
        userId: payload.createdBy,
      });
      await creatives.update(creative.id, {
        stage: "screenplay",
        status: "awaiting_review",
        screenplay,
        storyboard: null,
        video: null,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "storyboard") {
      if (!creative.screenplay) {
        throw new Error("Screenplay is required before storyboard generation.");
      }
      const storyboard = await generateStoryboard({
        screenplay: creative.screenplay,
        product,
        workspaceId: payload.workspaceId,
        creativeId: creative.id,
        userId: payload.createdBy,
        revisionFeedback: feedback || null,
      });
      await creatives.update(creative.id, {
        stage: "storyboard",
        status: "awaiting_review",
        storyboard,
        video: null,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "video") {
      if (!creative.storyboard) {
        throw new Error("Storyboard is required before video generation.");
      }
      if (!creative.screenplay) {
        throw new Error("Screenplay is required before video generation.");
      }
      const video = await generateVideo({
        screenplay: creative.screenplay,
        storyboard: creative.storyboard,
        product,
        workspaceId: payload.workspaceId,
        creativeId: creative.id,
        isCanceled: () => wasCanceled(payload.jobRunId),
      });
      await creatives.update(creative.id, {
        stage: "video",
        status: "awaiting_review",
        video,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "concept") {
      if (creative.kind !== "display_ad") {
        throw new Error("Concept stage is only valid for display ads.");
      }
      const intelligence = await products.getIntelligence(payload.productId);
      const concept = await generateDisplayConcept({
        brief: briefForGen,
        product,
        intelligence,
        workspaceId: payload.workspaceId,
        userId: payload.createdBy,
      });
      await creatives.update(creative.id, {
        stage: "concept",
        status: "awaiting_review",
        concept,
        assets: null,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "assets") {
      if (creative.kind !== "display_ad") {
        throw new Error("Assets stage is only valid for display ads.");
      }
      if (!creative.concept) {
        throw new Error("Concept is required before assets generation.");
      }
      const assets = await generateDisplayAssets({
        concept: creative.concept,
        product,
        workspaceId: payload.workspaceId,
        creativeId: creative.id,
        userId: payload.createdBy,
        revisionFeedback: feedback || null,
      });
      await creatives.update(creative.id, {
        stage: "assets",
        status: "awaiting_review",
        assets,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "copy") {
      if (creative.kind !== "search_ad") {
        throw new Error("Copy stage is only valid for search ads.");
      }
      const intelligence = await products.getIntelligence(payload.productId);
      const copy = await generateSearchCopy({
        brief: briefForGen,
        product,
        intelligence,
        workspaceId: payload.workspaceId,
        userId: payload.createdBy,
      });
      await creatives.update(creative.id, {
        stage: "copy",
        status: "awaiting_review",
        copy,
        keywords: null,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else if (payload.stage === "keywords") {
      if (creative.kind !== "search_ad") {
        throw new Error("Keywords stage is only valid for search ads.");
      }
      if (!creative.copy) {
        throw new Error("Copy is required before keywords generation.");
      }
      const intelligence = await products.getIntelligence(payload.productId);
      const keywords = await generateSearchKeywords({
        copy: creative.copy,
        brief: creative.brief,
        product,
        intelligence,
        workspaceId: payload.workspaceId,
        userId: payload.createdBy,
        revisionFeedback: feedback || null,
      });
      await creatives.update(creative.id, {
        stage: "keywords",
        status: "awaiting_review",
        keywords,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else {
      throw new Error(`Unsupported creative stage: ${payload.stage}`);
    }

    if (await wasCanceled(payload.jobRunId)) {
      // UI/Trigger cancel won the race — do not mark succeeded.
      return null;
    }

    const result = {
      creativeId: payload.creativeId,
      stage: payload.stage,
    };
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

    const reviewed = await creatives.getById(payload.creativeId);
    if (reviewed?.status === "awaiting_review") {
      const { notifyCreativeAwaitingReview } = await import(
        "@/lib/email/creative-review"
      );
      void notifyCreativeAwaitingReview(reviewed);
    }

    return result;
  } catch (err) {
    if (await wasCanceled(payload.jobRunId).catch(() => false)) {
      return null;
    }

    const message = clarifyTriggerSupabaseError(
      unknownErrorMessage(err, "Creative generation job failed."),
    );
    try {
      await jobs.update(payload.jobRunId, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
      });
    } catch {
      // Same bad Supabase env often breaks status writes too.
    }
    try {
      // Park as paused so the user can resume after a hard failure.
      await creatives.update(payload.creativeId, {
        status: "paused",
        activeJobId: null,
      });
    } catch {
      // Best-effort restore; original error already recorded on job.
    }

    try {
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
    } catch {
      // Best-effort insight enqueue.
    }

    throw new Error(message, { cause: err });
  }
}
