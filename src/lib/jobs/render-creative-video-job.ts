import type { CreativeAdProps } from "@/remotion/constants";
import {
  CREATIVE_AD_END_CARD_SEC,
} from "@/remotion/constants";
import { unknownErrorMessage } from "@/lib/errors";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import { renderCreativeAdVideo } from "@/lib/jobs/render-creative-video";
import {
  getCreativeWriteRepository,
  getJobWriteRepository,
} from "@/repositories";

export type RenderCreativeVideoJobPayload = {
  jobRunId: string;
  workspaceId: string;
  createdBy: string | null;
  creativeId: string;
  productId: string;
};

export async function runRenderCreativeVideoJob(
  payload: RenderCreativeVideoJobPayload,
): Promise<{ creativeId: string; videoUrl: string } | null> {
  assertTriggerJobEnv();

  const jobs = getJobWriteRepository();
  const creatives = getCreativeWriteRepository();

  const existing = await jobs.getById(payload.jobRunId);
  if (existing?.status === "canceled" || existing?.status === "succeeded") {
    return null;
  }

  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt: existing?.startedAt ?? new Date().toISOString(),
  });

  const creative = await creatives.getById(payload.creativeId);
  if (!creative || creative.workspaceId !== payload.workspaceId) {
    await jobs.update(payload.jobRunId, {
      status: "canceled",
      error: "Creative deleted",
      finishedAt: new Date().toISOString(),
    });
    return null;
  }

  if (!creative.video?.clips?.length) {
    throw new Error("Video clips are required to re-render.");
  }

  await creatives.update(payload.creativeId, {
    status: "generating",
    activeJobId: payload.jobRunId,
  });

  try {
    const props: CreativeAdProps = {
      clips: creative.video.clips.map((c) => ({
        sceneId: c.sceneId,
        videoUrl: c.url,
        audioUrl: c.audioUrl,
        durationSec: c.durationSec,
        caption: c.caption ?? "",
      })),
      productTitle: creative.video.productTitle || creative.title,
      endCardSec: CREATIVE_AD_END_CARD_SEC,
    };

    const rendered = await renderCreativeAdVideo({
      workspaceId: payload.workspaceId,
      creativeId: creative.id,
      props,
    });

    const nextVideo = {
      ...creative.video,
      url: rendered.videoUrl,
      thumbnailUrl: rendered.thumbnailUrl,
      durationSec: rendered.durationSec,
    };

    await creatives.update(creative.id, {
      stage: "video",
      status: "awaiting_review",
      video: nextVideo,
      activeJobId: null,
      revisionFeedback: null,
    });

    await jobs.update(payload.jobRunId, {
      status: "succeeded",
      result: { creativeId: creative.id, videoUrl: rendered.videoUrl },
      error: null,
      finishedAt: new Date().toISOString(),
    });

    const reviewed = await creatives.getById(creative.id);
    if (reviewed?.status === "awaiting_review") {
      const { notifyCreativeAwaitingReview } = await import(
        "@/lib/email/creative-review"
      );
      void notifyCreativeAwaitingReview(reviewed);
    }

    return { creativeId: creative.id, videoUrl: rendered.videoUrl };
  } catch (err) {
    const message = clarifyTriggerSupabaseError(
      unknownErrorMessage(err, "Creative re-render failed."),
    );
    try {
      await jobs.update(payload.jobRunId, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
    try {
      await creatives.update(payload.creativeId, {
        status: "paused",
        activeJobId: null,
      });
    } catch {
      // ignore
    }
    throw new Error(message, { cause: err });
  }
}
