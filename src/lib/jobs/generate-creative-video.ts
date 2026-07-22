import type {
  Product,
  ScreenplayPayload,
  StoryboardPayload,
  VideoClip,
  VideoPayload,
} from "@/domain";
import { videoPayloadSchema } from "@/domain";
import { synthesizeSceneAudio, createCreativeVoiceCast, resolveSceneVoiceId } from "@/lib/media/elevenlabs";
import { assertElevenLabsConfigured, assertRunwayConfigured } from "@/lib/media/env";
import { generateVeoClip } from "@/lib/media/runway";
import type { CreativeAdClip } from "@/remotion/constants";

export type GenerateVideoOpts = {
  screenplay: ScreenplayPayload;
  storyboard: StoryboardPayload;
  product: Product;
  workspaceId: string;
  creativeId: string;
  /** Called between scenes; throw or return true to abort. */
  isCanceled?: () => Promise<boolean>;
};

async function throwIfCanceled(isCanceled?: () => Promise<boolean>) {
  if (isCanceled && (await isCanceled())) {
    throw new Error("Video generation canceled");
  }
}

/**
 * Full video stage: ElevenLabs TTS → Runway Veo 3.1 per frame → Remotion stitch.
 */
export async function generateVideo(
  opts: GenerateVideoOpts,
): Promise<VideoPayload> {
  assertElevenLabsConfigured();
  assertRunwayConfigured();

  const sceneById = new Map(
    opts.screenplay.scenes.map((scene) => [scene.id, scene]),
  );

  const voiceCast = await createCreativeVoiceCast({
    creativeId: opts.creativeId,
    scenes: opts.screenplay.scenes,
  });

  const clips: VideoClip[] = [];

  for (const frame of opts.storyboard.frames) {
    await throwIfCanceled(opts.isCanceled);

    const scene = sceneById.get(frame.sceneId);
    const dialogue = scene?.dialogue?.trim() ?? "";
    const spokenKind = scene?.spokenKind ?? "voiceover";
    const durationSec = scene?.durationSec ?? 4;

    const audioUrl = dialogue
      ? await synthesizeSceneAudio({
          text: dialogue,
          voiceId: resolveSceneVoiceId(voiceCast, {
            spokenKind,
            character: scene?.character ?? "",
          }),
          workspaceId: opts.workspaceId,
          creativeId: opts.creativeId,
          sceneId: frame.sceneId,
        })
      : null;

    await throwIfCanceled(opts.isCanceled);

    const promptText = [
      frame.shotDescription,
      frame.camera ? `Camera: ${frame.camera}` : null,
      scene?.action ? `Action: ${scene.action}` : null,
      opts.storyboard.styleBrief
        ? `Style: ${opts.storyboard.styleBrief}`
        : null,
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 1000);

    const veo = await generateVeoClip({
      promptImageUrl: frame.imageUrl,
      promptText,
      durationSec,
      workspaceId: opts.workspaceId,
      creativeId: opts.creativeId,
      sceneId: frame.sceneId,
    });

    clips.push({
      sceneId: frame.sceneId,
      url: veo.url,
      audioUrl,
      thumbnailUrl: frame.imageUrl,
      durationSec: veo.durationSec,
      prompt: promptText,
      caption: dialogue,
    });
  }

  if (clips.length === 0) {
    throw new Error("No storyboard frames available for video generation.");
  }

  await throwIfCanceled(opts.isCanceled);

  // Dynamic import keeps @remotion/bundler out of modules that only need
  // screenplay/storyboard (and out of Next.js API graphs that import those).
  const { renderCreativeAdVideo } = await import(
    "@/lib/jobs/render-creative-video"
  );

  const remotionClips: CreativeAdClip[] = clips.map((c) => ({
    sceneId: c.sceneId,
    videoUrl: c.url,
    audioUrl: c.audioUrl,
    durationSec: c.durationSec,
    caption: c.caption,
  }));

  const rendered = await renderCreativeAdVideo({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    props: {
      clips: remotionClips,
      productTitle: opts.product.title,
    },
  });

  const payload: VideoPayload = {
    url: rendered.videoUrl,
    thumbnailUrl: rendered.thumbnailUrl,
    durationSec: rendered.durationSec,
    aspectRatio: opts.screenplay.aspectRatio || "16:9",
    clips,
    productTitle: opts.product.title,
  };

  return videoPayloadSchema.parse(payload);
}
