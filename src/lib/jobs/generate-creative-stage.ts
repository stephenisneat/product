import type { CreativeStage, GenerateCreativeStageJobInput } from "@/domain";
import { unknownErrorMessage } from "@/lib/errors";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import {
  buildStubVideo,
  buildTemplateScreenplay,
  buildTemplateStoryboard,
  sleep,
} from "@/lib/jobs/creative-stubs";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
  getProductWriteRepository,
} from "@/repositories";

export type GenerateCreativeStageJobPayload = {
  jobRunId: string;
  workspaceId: string;
  createdBy: string | null;
  creativeId: string;
  productId: string;
  stage: CreativeStage;
};

export function payloadFromGenerateCreativeStageInput(
  jobRunId: string,
  workspaceId: string,
  createdBy: string | null,
  input: GenerateCreativeStageJobInput,
): GenerateCreativeStageJobPayload {
  return {
    jobRunId,
    workspaceId,
    createdBy,
    creativeId: input.creativeId,
    productId: input.productId,
    stage: input.stage,
  };
}

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

    // Simulate async generation latency for stub pipeline.
    await sleep(800);

    if (await wasCanceled(payload.jobRunId)) {
      return null;
    }

    const feedback = creative.revisionFeedback?.trim() || "";
    const briefForGen = feedback
      ? `${creative.brief}\n\nRevision notes: ${feedback}`
      : creative.brief;

    if (payload.stage === "screenplay") {
      const screenplay = buildTemplateScreenplay(briefForGen, product.title);
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
      const storyboard = buildTemplateStoryboard(creative.screenplay);
      if (feedback) {
        storyboard.styleBrief = `${storyboard.styleBrief} Revision: ${feedback}`;
      }
      await creatives.update(creative.id, {
        stage: "storyboard",
        status: "awaiting_review",
        storyboard,
        video: null,
        activeJobId: null,
        revisionFeedback: null,
      });
    } else {
      if (!creative.storyboard) {
        throw new Error("Storyboard is required before video generation.");
      }
      const video = buildStubVideo(creative.screenplay);
      await creatives.update(creative.id, {
        stage: "video",
        status: "awaiting_review",
        video,
        activeJobId: null,
        revisionFeedback: null,
      });
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
