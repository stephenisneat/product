import type { CreativeStage, GenerateCreativeStageJobInput } from "@/domain";
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

export async function runGenerateCreativeStageJob(
  payload: GenerateCreativeStageJobPayload,
): Promise<{ creativeId: string; stage: CreativeStage }> {
  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();
  const products = getProductWriteRepository();

  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const creative = await creatives.getById(payload.creativeId);
    if (!creative || creative.workspaceId !== payload.workspaceId) {
      throw new Error("Creative not found in workspace.");
    }

    const product = await products.getProduct(payload.productId);
    if (!product || product.workspaceId !== payload.workspaceId) {
      throw new Error("Product not found in workspace.");
    }

    // Simulate async generation latency for stub pipeline.
    await sleep(800);

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
    const message =
      err instanceof Error ? err.message : "Creative generation job failed.";
    await jobs.update(payload.jobRunId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    try {
      await creatives.update(payload.creativeId, {
        status: "awaiting_review",
        activeJobId: null,
      });
    } catch {
      // Best-effort restore; original error already recorded on job.
    }

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
