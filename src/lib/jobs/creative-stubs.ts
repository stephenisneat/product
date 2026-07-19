import type {
  CreativeStage,
  ScreenplayPayload,
  StoryboardPayload,
  VideoPayload,
} from "@/domain";

/** Public sample clip used as a stub rendered video. */
const STUB_VIDEO_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const STUB_THUMBNAIL_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg";

export function buildTemplateScreenplay(
  brief: string,
  productTitle?: string,
): ScreenplayPayload {
  const subject = productTitle?.trim() || "the product";
  const idea = brief.trim() || `A short vertical ad for ${subject}`;

  const scenes = [
    {
      id: "scene-1",
      heading: "OPENING HOOK",
      action: `Cold open on ${subject}. Fast cut that matches: ${idea}`,
      dialogue: "Wait — this changes everything.",
      durationSec: 3,
    },
    {
      id: "scene-2",
      heading: "PROBLEM",
      action: "Show the everyday friction the audience feels before finding this product.",
      dialogue: "You've been doing it the hard way.",
      durationSec: 4,
    },
    {
      id: "scene-3",
      heading: "PRODUCT REVEAL",
      action: `Reveal ${subject} in use. Clean, confident framing. Highlight the key benefit from the brief.`,
      dialogue: `Meet ${subject}.`,
      durationSec: 5,
    },
    {
      id: "scene-4",
      heading: "CTA",
      action: "End card with logo, offer, and a clear call to action.",
      dialogue: "Tap to shop now.",
      durationSec: 3,
    },
  ];

  const script = scenes
    .map(
      (s) =>
        `${s.heading}\n${s.action}${s.dialogue ? `\n"${s.dialogue}"` : ""}`,
    )
    .join("\n\n");

  return {
    logline: idea.slice(0, 200),
    script,
    scenes,
    aspectRatio: "9:16",
    targetDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
  };
}

export function buildTemplateStoryboard(
  screenplay: ScreenplayPayload,
): StoryboardPayload {
  const frames = screenplay.scenes.map((scene, index) => ({
    sceneId: scene.id,
    shotDescription: scene.action,
    camera:
      index === 0
        ? "Handheld close-up, punch-in"
        : index === screenplay.scenes.length - 1
          ? "Static end card, centered"
          : "Medium tracking shot",
    imageUrl: `https://placehold.co/720x1280/1a1a1a/f5f5f5/png?text=${encodeURIComponent(scene.heading.slice(0, 18))}`,
  }));

  return {
    styleBrief:
      "Clean commercial aesthetic, high-contrast lighting, vertical 9:16, modern product-ad pacing.",
    frames,
  };
}

export function buildStubVideo(screenplay: ScreenplayPayload | null): VideoPayload {
  return {
    url: STUB_VIDEO_URL,
    thumbnailUrl: STUB_THUMBNAIL_URL,
    durationSec: screenplay?.targetDurationSec ?? 15,
    aspectRatio: screenplay?.aspectRatio ?? "9:16",
  };
}

export function jobTypeForStage(stage: CreativeStage) {
  switch (stage) {
    case "screenplay":
      return "generate_creative_screenplay" as const;
    case "storyboard":
      return "generate_creative_storyboard" as const;
    case "video":
      return "generate_creative_video" as const;
  }
}

export function nextStageAfterAccept(
  stage: CreativeStage,
): CreativeStage | null {
  switch (stage) {
    case "screenplay":
      return "storyboard";
    case "storyboard":
      return "video";
    case "video":
      return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
