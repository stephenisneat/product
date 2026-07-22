import type {
  CreativeStage,
  ScreenplayPayload,
  StoryboardPayload,
  VideoPayload,
  WorldPayload,
} from "@/domain";

/** Public sample clip used as a stub rendered video. */
const STUB_VIDEO_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const STUB_THUMBNAIL_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg";
const STUB_SHEET_URL =
  "https://placehold.co/1280x720/1a1a1a/f5f5f5/png?text=World";

/**
 * Deterministic screenplay / world / storyboard / video builders for **unit tests only**.
 * Production generation requires AI Gateway, ElevenLabs, and Runway — there is
 * intentionally no offline stub fallback in job runners.
 */
export function buildTemplateScreenplay(
  brief: string,
  productTitle?: string,
): ScreenplayPayload {
  const subject = productTitle?.trim() || "the product";
  const idea = brief.trim() || `A short 16:9 video ad for ${subject}`;

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
    aspectRatio: "16:9",
    targetDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
  };
}

export function buildTemplateWorld(
  screenplay: ScreenplayPayload,
  productTitle?: string,
): WorldPayload {
  const subject = productTitle?.trim() || "the product";
  const characters = [
    ...new Set(
      screenplay.scenes
        .filter((s) => s.spokenKind === "dialogue" && s.character.trim())
        .map((s) => s.character.trim().toUpperCase()),
    ),
  ].map((name) => ({
    name,
    ageRange: "30s",
    presentation: "feminine",
    face: "warm open expression, soft features",
    hair: "shoulder-length dark hair",
    wardrobe: "navy cardigan over cream tee",
    distinguishingMarks: "small silver hoop earrings",
    appearanceSummary: `${name}, 30s, navy cardigan, warm open expression`,
    sheetUrl: `${STUB_SHEET_URL}+${encodeURIComponent(name)}`,
    voiceId: "stub-voice-maya",
    voiceName: "Stub Maya",
  }));

  const locations = [
    {
      id: "loc-sidewalk",
      name: "City sidewalk",
      description: "Urban sidewalk near subway entrance, daylight, concrete.",
      interiorExterior: "exterior" as const,
      timeOfDay: "day",
      sheetUrl: `${STUB_SHEET_URL}+Sidewalk`,
    },
    {
      id: "loc-kitchen",
      name: "Studio kitchen",
      description: "Bright kitchen with soft window light and clean counters.",
      interiorExterior: "interior" as const,
      timeOfDay: "day",
      sheetUrl: `${STUB_SHEET_URL}+Kitchen`,
    },
    {
      id: "loc-entryway",
      name: "Entryway",
      description: "Quiet residential entryway at night, console table, plant.",
      interiorExterior: "interior" as const,
      timeOfDay: "night",
      sheetUrl: `${STUB_SHEET_URL}+Entryway`,
    },
  ];

  const sceneLocationIds: Record<string, string> = {};
  for (const scene of screenplay.scenes) {
    const heading = scene.heading.toUpperCase();
    if (heading.includes("SIDEWALK") || heading.includes("EXT.")) {
      sceneLocationIds[scene.id] = "loc-sidewalk";
    } else if (heading.includes("ENTRY")) {
      sceneLocationIds[scene.id] = "loc-entryway";
    } else {
      sceneLocationIds[scene.id] = "loc-kitchen";
    }
  }

  return {
    styleBible:
      "Clean commercial aesthetic, high-contrast soft window light, landscape 16:9, modern product-ad grade.",
    styleLockUrl: `${STUB_SHEET_URL}+Style`,
    characters,
    locations,
    sceneLocationIds,
    productAppearance: `${subject}: match packaging and label from product photos exactly.`,
    productLockUrls: [`${STUB_SHEET_URL}+Product`],
    brandLock: subject,
    continuityNotes: "MAYA always wears navy cardigan; product label faces camera.",
    voiceCast: {
      voiceoverId: "stub-voice-vo",
      voiceoverName: "Stub Narrator",
      characterVoices: Object.fromEntries(
        characters.map((c) => [c.name, c.voiceId]),
      ),
      characterVoiceNames: Object.fromEntries(
        characters.map((c) => [c.name, c.voiceName]),
      ),
    },
  };
}

export function buildTemplateStoryboard(
  screenplay: ScreenplayPayload,
  world?: WorldPayload | null,
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
    imageUrl: `https://placehold.co/1280x720/1a1a1a/f5f5f5/png?text=${encodeURIComponent(scene.heading.slice(0, 18))}`,
  }));

  return {
    styleBrief:
      world?.styleBible ??
      "Clean commercial aesthetic, high-contrast lighting, landscape 16:9, modern product-ad pacing.",
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
    aspectRatio: screenplay?.aspectRatio ?? "16:9",
    clips,
  };
}

export function jobTypeForStage(stage: CreativeStage) {
  switch (stage) {
    case "screenplay":
      return "generate_creative_screenplay" as const;
    case "world":
      return "generate_creative_world" as const;
    case "storyboard":
      return "generate_creative_storyboard" as const;
    case "video":
      return "generate_creative_video" as const;
    case "concept":
      return "generate_creative_concept" as const;
    case "assets":
      return "generate_creative_assets" as const;
    case "copy":
      return "generate_creative_copy" as const;
    case "keywords":
      return "generate_creative_keywords" as const;
    case "script":
      return "generate_creative_script" as const;
    case "audio":
      return "generate_creative_audio" as const;
  }
}

export function nextStageAfterAccept(
  stage: CreativeStage,
): CreativeStage | null {
  switch (stage) {
    case "screenplay":
      return "world";
    case "world":
      return "storyboard";
    case "storyboard":
      return "video";
    case "video":
      return null;
    case "concept":
      return "assets";
    case "assets":
      return null;
    case "copy":
      return "keywords";
    case "keywords":
      return null;
    case "script":
      return "audio";
    case "audio":
      return null;
  }
}

/**
 * Video ads auto-run screenplay → world → storyboard without Accept.
 * Returns the next stage to enqueue, or null when generation should pause
 * for the user (storyboard ready → manual Generate video).
 */
export function nextAutoAdvanceStage(
  stage: CreativeStage,
): CreativeStage | null {
  switch (stage) {
    case "screenplay":
      return "world";
    case "world":
      return "storyboard";
    default:
      return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
