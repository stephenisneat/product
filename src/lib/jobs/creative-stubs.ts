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

/**
 * Deterministic screenplay / storyboard / video builders for **unit tests only**.
 * Production generation requires AI Gateway, ElevenLabs, and Runway — there is
 * intentionally no offline stub fallback in job runners.
 */
export function buildTemplateScreenplay(
  brief: string,
  productTitle?: string,
): ScreenplayPayload {
  const subject = productTitle?.trim() || "the product";
  const idea = brief.trim() || `A short vertical ad for ${subject}`;

  const scenes = [
    {
      id: "scene-1",
      heading: "EXT. CITY SIDEWALK - DAY",
      action: `A young commuter jogs up subway stairs, phone slipping from a jacket pocket. ${subject} is not in frame yet — only the near-drop and a frustrated glance at the cracked sidewalk.`,
      dialogue: "Every morning, same near-disaster.",
      spokenKind: "voiceover" as const,
      character: "",
      durationSec: 3,
    },
    {
      id: "scene-2",
      heading: "INT. STUDIO KITCHEN - DAY",
      action: `Close on tired hands wrestling a tangled charger cable beside a half-eaten breakfast. Cut to a second person (MAYA, 30s) watching, then pointing at a clean ${subject} box on the counter.`,
      dialogue: "You don't have to keep fighting that thing.",
      spokenKind: "dialogue" as const,
      character: "MAYA",
      durationSec: 4,
    },
    {
      id: "scene-3",
      heading: "INT. STUDIO KITCHEN - CONTINUOUS",
      action: `MAYA lifts ${subject} into frame, peels the seal, and slots it onto the counter in one fluid move. Soft window light; product label readable; no text overlays.`,
      dialogue: `This is ${subject}. Built for the mess you actually live in.`,
      spokenKind: "voiceover" as const,
      character: "",
      durationSec: 5,
    },
    {
      id: "scene-4",
      heading: "INT. ENTRYWAY - NIGHT",
      action: `End card: ${subject} on a console table beside keys and a plant. A hand taps the product once, then the room lights dim to a clean logo hold. Brief idea echoed: ${idea.slice(0, 80)}`,
      dialogue: "Get yours tonight.",
      spokenKind: "dialogue" as const,
      character: "MAYA",
      durationSec: 3,
    },
  ];

  const script = scenes
    .map((s) => {
      const speaker =
        s.dialogue && s.spokenKind === "dialogue"
          ? s.character || "CHARACTER"
          : s.dialogue
            ? "VOICEOVER"
            : null;
      return `${s.heading}\n${s.action}${
        speaker && s.dialogue ? `\n${speaker}\n"${s.dialogue}"` : ""
      }`;
    })
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
  const scenes = screenplay?.scenes ?? [];
  const clips = scenes.map((scene) => ({
    sceneId: scene.id,
    url: STUB_VIDEO_URL,
    audioUrl: null,
    thumbnailUrl: STUB_THUMBNAIL_URL,
    durationSec: scene.durationSec,
    caption: scene.dialogue ?? "",
  }));

  return {
    url: STUB_VIDEO_URL,
    thumbnailUrl: STUB_THUMBNAIL_URL,
    durationSec: screenplay?.targetDurationSec ?? 15,
    aspectRatio: screenplay?.aspectRatio ?? "9:16",
    clips,
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
    case "concept":
      return "generate_creative_concept" as const;
    case "assets":
      return "generate_creative_assets" as const;
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
    case "concept":
      return "assets";
    case "assets":
      return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
