import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  Product,
  ScreenplayPayload,
  StoryboardPayload,
  WorldPayload,
} from "@/domain";
import {
  screenplayPayloadSchema,
  screenplaySpokenKindSchema,
  storyboardPayloadSchema,
} from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import { hasAiGateway } from "@/lib/mode";
import { createServiceClient } from "@/lib/supabase/service";
import { chargeAiUsage } from "@/lib/wallet/gate";

/** Fast structured model for screenplay + shot planning. */
export const CREATIVE_TEXT_MODEL = "openai/gpt-4.1-mini";
/** Multimodal image model via AI Gateway. */
export const CREATIVE_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

function assertAiGatewayConfigured(): void {
  if (hasAiGateway()) return;
  throw new Error(
    "AI Gateway is not configured for creative generation. " +
      "Set AI_GATEWAY_API_KEY in this environment (and in Trigger.dev → Environment Variables), then retry.",
  );
}

const generatedSceneSchema = z.object({
  id: z.string(),
  heading: z.string(),
  action: z.string(),
  dialogue: z.string(),
  spokenKind: screenplaySpokenKindSchema,
  character: z.string(),
  durationSec: z.number().positive(),
});

const generatedScreenplaySchema = z.object({
  logline: z.string(),
  aspectRatio: z.string(),
  scenes: z.array(generatedSceneSchema).min(3).max(8),
});

const generatedFramePlanSchema = z.object({
  sceneId: z.string(),
  shotDescription: z.string(),
  camera: z.string(),
  imagePrompt: z.string(),
});

const generatedStoryboardPlanSchema = z.object({
  styleBrief: z.string(),
  frames: z.array(generatedFramePlanSchema).min(1),
});

function productContext(product: Product): string {
  const bits = [
    `Title: ${product.title}`,
    product.description?.trim()
      ? `Description: ${product.description.trim().slice(0, 1200)}`
      : null,
    product.category ? `Category: ${product.category}` : null,
    Number.isFinite(product.price)
      ? `Price: ${product.currency} ${product.price}`
      : null,
  ].filter(Boolean);
  return bits.join("\n");
}

function buildScriptFromScenes(
  scenes: ScreenplayPayload["scenes"],
): string {
  return scenes
    .map((s) => {
      const speaker =
        s.dialogue && s.spokenKind === "dialogue"
          ? s.character.trim() || "CHARACTER"
          : s.dialogue
            ? "VOICEOVER"
            : null;
      return `${s.heading}\n${s.action}${
        speaker && s.dialogue ? `\n${speaker}\n"${s.dialogue}"` : ""
      }`;
    })
    .join("\n\n");
}

async function maybeCharge(opts: {
  workspaceId: string;
  userId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  if (!opts.userId) return;
  const gatewayModel = await getGatewayChatModel(opts.model).catch(() => null);
  await chargeAiUsage({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    inputTokens: opts.inputTokens,
    outputTokens: opts.outputTokens,
    model: opts.model,
    tokenPricing: gatewayModel?.pricing ?? null,
  });
}

export async function generateScreenplay(opts: {
  brief: string;
  product: Product;
  workspaceId: string;
  userId: string | null;
}): Promise<ScreenplayPayload> {
  assertAiGatewayConfigured();

  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedScreenplaySchema }),
    system: `You write landscape (16:9) short-form video ad screenplays for DTC products.

Rules:
- Every action line must be concrete and filmable: name the subject, location, props, motion, and camera-relevant detail. Never use vague marketing language like "show the friction", "highlight the benefit", "everyday struggle", or "reveal the product confidently".
- Prefer specific sensory detail (lighting, textures, time of day, body language).
- Mix delivery modes across the ad when it serves the story:
  - voiceover: unseen narrator; spokenKind="voiceover", character="".
  - on-camera dialogue: a named person speaking; spokenKind="dialogue", character set to a short UPPERCASE name (e.g. MAYA, DAD).
- Not every scene needs spoken audio. Some scenes can be silent (dialogue="").
- Avoid making every line a voiceover. Use character dialogue for problem/testimonial/demo beats when natural.
- 4–6 scenes, total duration roughly 12–20 seconds.
- Headings are short sluglines (e.g. "INT. KITCHEN - MORNING" or "OPENING HOOK - BUS STOP").
- dialogue is the exact spoken words only (no attribution inside the string).`,
    prompt: `Write a screenplay for this product ad.

Product:
${productContext(opts.product)}

Creative brief:
${opts.brief.trim() || `A short 16:9 video ad for ${opts.product.title}`}

Return aspectRatio "16:9". Give each scene a stable id like "scene-1".`,
  });

  await maybeCharge({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    model: CREATIVE_TEXT_MODEL,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  });

  const raw = result.output;
  if (!raw) {
    throw new Error("Screenplay model returned no structured output.");
  }

  const scenes = raw.scenes.map((scene, index) => ({
    ...scene,
    id: scene.id || `scene-${index + 1}`,
    character:
      scene.spokenKind === "dialogue" ? scene.character.trim() : "",
    dialogue: scene.dialogue.trim(),
  }));

  const payload: ScreenplayPayload = {
    logline: raw.logline.trim(),
    script: buildScriptFromScenes(scenes),
    scenes,
    aspectRatio: raw.aspectRatio || "16:9",
    targetDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
  };

  return screenplayPayloadSchema.parse(payload);
}

/**
 * Apply a localized review comment to a screenplay selection.
 * Returns a full proposed screenplay the user can accept or reject.
 */
export async function suggestScreenplayEdit(opts: {
  screenplay: ScreenplayPayload;
  selectedText: string;
  comment: string;
  workspaceId: string;
  userId: string | null;
}): Promise<{ screenplay: ScreenplayPayload; summary: string }> {
  assertAiGatewayConfigured();

  const selectedText = opts.selectedText.trim();
  const comment = opts.comment.trim();
  if (!selectedText || !comment) {
    throw new Error("Selection and comment are required.");
  }

  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({
      schema: z.object({
        summary: z.string(),
        logline: z.string(),
        aspectRatio: z.string(),
        scenes: z.array(generatedSceneSchema).min(1).max(12),
      }),
    }),
    system: `You revise short-form video ad screenplays based on a reviewer's inline comment.

Rules:
- Change only what the comment asks for. Preserve scene ids, structure, tone, and untouched scenes.
- Keep filmable, concrete action lines — never vague marketing language.
- dialogue is spoken words only. spokenKind is "voiceover" or "dialogue"; character is UPPERCASE when dialogue.
- Keep aspectRatio and roughly the same total duration unless the comment requires otherwise.
- summary is one short sentence describing the edit for the reviewer.`,
    prompt: `Current screenplay JSON:
${JSON.stringify(opts.screenplay, null, 2)}

Selected text the reviewer highlighted:
"""
${selectedText}
"""

Reviewer comment:
"""
${comment}
"""

Return the full revised screenplay (all scenes), with minimal changes.`,
  });

  await maybeCharge({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    model: CREATIVE_TEXT_MODEL,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  });

  const raw = result.output;
  if (!raw) {
    throw new Error("Screenplay edit model returned no structured output.");
  }

  const scenes = raw.scenes.map((scene, index) => ({
    ...scene,
    id: scene.id || `scene-${index + 1}`,
    character:
      scene.spokenKind === "dialogue" ? scene.character.trim() : "",
    dialogue: scene.dialogue.trim(),
  }));

  const screenplay = screenplayPayloadSchema.parse({
    logline: raw.logline.trim(),
    script: buildScriptFromScenes(scenes),
    scenes,
    aspectRatio: raw.aspectRatio || opts.screenplay.aspectRatio || "16:9",
    targetDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
  });

  return {
    screenplay,
    summary: raw.summary.trim() || "Proposed edit based on your comment.",
  };
}

async function uploadCreativeFrameImage(opts: {
  workspaceId: string;
  creativeId: string;
  sceneId: string;
  bytes: Uint8Array;
  mediaType: string;
}): Promise<string> {
  const ext = opts.mediaType.includes("jpeg")
    ? "jpg"
    : opts.mediaType.includes("webp")
      ? "webp"
      : "png";
  const path = `${opts.workspaceId}/creatives/${opts.creativeId}/${opts.sceneId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from("workspace-assets")
    .upload(path, opts.bytes, {
      cacheControl: "3600",
      contentType: opts.mediaType || "image/png",
      upsert: false,
    });
  if (error) {
    throw new Error(error.message || "Failed to upload storyboard frame");
  }
  const { data } = supabase.storage.from("workspace-assets").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Multimodal reference URLs for a storyboard still (or single-frame regen).
 * Always reattaches the same world locks for the scene's location + cast + product.
 */
export function worldReferenceUrlsForScene(opts: {
  world: WorldPayload;
  product: Product;
  sceneId: string;
  characterNames: string[];
  limit?: number;
}): string[] {
  const locationId = opts.world.sceneLocationIds[opts.sceneId];
  const location = opts.world.locations.find((l) => l.id === locationId);
  const characters = opts.world.characters.filter((c) =>
    opts.characterNames.includes(c.name.toUpperCase()),
  );
  const referenceUrls: string[] = [
    opts.world.styleLockUrl,
    ...(location ? [location.sheetUrl] : []),
    ...characters.map((c) => c.sheetUrl),
    ...opts.world.productLockUrls,
    ...opts.product.images,
  ].filter(Boolean);
  return [...new Set(referenceUrls)].slice(0, opts.limit ?? 8);
}

/** Characters likely visible in a scene (dialogue speaker + names mentioned in action). */
export function charactersForScene(
  scene: ScreenplayPayload["scenes"][number],
  world: WorldPayload,
): string[] {
  const names = new Set<string>();
  if (scene.spokenKind === "dialogue" && scene.character.trim()) {
    names.add(scene.character.trim().toUpperCase());
  }
  const actionUpper = scene.action.toUpperCase();
  for (const character of world.characters) {
    if (actionUpper.includes(character.name.toUpperCase())) {
      names.add(character.name.toUpperCase());
    }
  }
  return [...names];
}

async function generateFrameImage(opts: {
  styleBrief: string;
  imagePrompt: string;
  product: Product;
  world: WorldPayload;
  sceneId: string;
  characterNames: string[];
  workspaceId: string;
  creativeId: string;
  userId: string | null;
}): Promise<string> {
  const locationId = opts.world.sceneLocationIds[opts.sceneId];
  const location = opts.world.locations.find((l) => l.id === locationId);
  const characters = opts.world.characters.filter((c) =>
    opts.characterNames.includes(c.name.toUpperCase()),
  );

  const uniqueRefs = worldReferenceUrlsForScene({
    world: opts.world,
    product: opts.product,
    sceneId: opts.sceneId,
    characterNames: opts.characterNames,
  });

  const characterBlock =
    characters.length > 0
      ? characters
          .map(
            (c) =>
              `- ${c.name}: ${c.appearanceSummary || [c.face, c.hair, c.wardrobe].filter(Boolean).join(", ")}`,
          )
          .join("\n")
      : "- No on-camera dialogue characters required in this still.";

  const textPrompt = `Create a single landscape 16:9 commercial storyboard still (no collage, no text overlays, no watermarks, no UI chrome).

Match the attached world reference images exactly for style grade, set design, character identity/wardrobe, and product appearance. Only change camera, action, and framing for this shot.

Style bible: ${opts.styleBrief}
${opts.world.continuityNotes?.trim() ? `Continuity: ${opts.world.continuityNotes.trim()}` : ""}
${location ? `Location/set: ${location.name} — ${location.description}` : ""}
Characters in frame:
${characterBlock}
Product: ${opts.product.title}
${opts.world.productAppearance?.trim() ? `Product appearance lock: ${opts.world.productAppearance.trim()}` : ""}
${opts.world.brandLock?.trim() ? `Brand: ${opts.world.brandLock.trim()}` : ""}
${opts.product.description?.trim() ? `Product context: ${opts.product.description.trim().slice(0, 400)}` : ""}

Shot: ${opts.imagePrompt}

Photoreal or polished commercial still. Do not invent new faces, wardrobes, sets, or packaging.`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: URL }
  > = [{ type: "text", text: textPrompt }];

  for (const url of uniqueRefs) {
    try {
      content.push({ type: "image", image: new URL(url) });
    } catch {
      // Skip invalid URLs.
    }
  }

  const result = await generateText({
    model: CREATIVE_IMAGE_MODEL,
    messages: [{ role: "user", content }],
  });

  await maybeCharge({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    model: CREATIVE_IMAGE_MODEL,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  });

  const imageFile = result.files.find((f) =>
    f.mediaType?.startsWith("image/"),
  );
  if (!imageFile) {
    throw new Error(`No image returned for scene ${opts.sceneId}.`);
  }

  return uploadCreativeFrameImage({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    sceneId: opts.sceneId,
    bytes: imageFile.uint8Array,
    mediaType: imageFile.mediaType || "image/png",
  });
}

export async function generateStoryboard(opts: {
  screenplay: ScreenplayPayload;
  world: WorldPayload;
  product: Product;
  workspaceId: string;
  creativeId: string;
  userId: string | null;
  revisionFeedback?: string | null;
}): Promise<StoryboardPayload> {
  assertAiGatewayConfigured();

  const styleBrief = opts.world.styleBible.trim();
  const castDigest = opts.world.characters
    .map((c) => `- ${c.name}: ${c.appearanceSummary}`)
    .join("\n");
  const locationDigest = opts.world.locations
    .map((l) => `- ${l.id} (${l.name}): ${l.description}`)
    .join("\n");

  const sceneDigest = opts.screenplay.scenes
    .map((s) => {
      const spoken = s.dialogue
        ? ` [${s.spokenKind}${s.character ? `:${s.character}` : ""}] "${s.dialogue}"`
        : "";
      const locId = opts.world.sceneLocationIds[s.id];
      return `- ${s.id} | ${s.heading} (${s.durationSec}s) | location=${locId ?? "unknown"}\n  Action: ${s.action}${spoken}`;
    })
    .join("\n");

  const planResult = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedStoryboardPlanSchema }),
    system: `You plan landscape 16:9 storyboard frames for a product video ad.
The visual world is already locked — do NOT invent new style, faces, wardrobes, or sets.
For each screenplay scene, produce one frame with:
- shotDescription: concrete visual description of the still
- camera: lens/framing/movement note
- imagePrompt: a self-contained image-generation prompt that references the locked cast/location/product and only varies camera/action.
Set styleBrief to the provided style bible verbatim (or a trivial copy).`,
    prompt: `Product:
${productContext(opts.product)}

Locked style bible (use as styleBrief):
${styleBrief}

Locked cast:
${castDigest || "(none)"}

Locked locations:
${locationDigest}

Product appearance: ${opts.world.productAppearance}
Brand: ${opts.world.brandLock}
Continuity: ${opts.world.continuityNotes}

Screenplay logline: ${opts.screenplay.logline}

Scenes:
${sceneDigest}

${opts.revisionFeedback?.trim() ? `Revision notes: ${opts.revisionFeedback.trim()}` : ""}

Return one frame per scene (matching sceneId).`,
  });

  await maybeCharge({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    model: CREATIVE_TEXT_MODEL,
    inputTokens: planResult.usage.inputTokens ?? 0,
    outputTokens: planResult.usage.outputTokens ?? 0,
  });

  const plan = planResult.output;
  if (!plan) {
    throw new Error("Storyboard planner returned no structured output.");
  }

  // Preserve screenplay order; fall back to scene action if a frame is missing.
  const frames = await Promise.all(
    opts.screenplay.scenes.map(async (scene) => {
      const planned =
        plan.frames.find((f) => f.sceneId === scene.id) ??
        plan.frames[
          opts.screenplay.scenes.findIndex((s) => s.id === scene.id)
        ];
      const shotDescription =
        planned?.shotDescription?.trim() || scene.action;
      const camera = planned?.camera?.trim() || "Medium shot, locked off";
      const imagePrompt =
        planned?.imagePrompt?.trim() ||
        `${scene.heading}: ${scene.action}. Landscape 16:9 commercial still featuring ${opts.product.title}.`;

      const imageUrl = await generateFrameImage({
        styleBrief,
        imagePrompt,
        product: opts.product,
        world: opts.world,
        sceneId: scene.id,
        characterNames: charactersForScene(scene, opts.world),
        workspaceId: opts.workspaceId,
        creativeId: opts.creativeId,
        userId: opts.userId,
      });

      return {
        sceneId: scene.id,
        shotDescription,
        camera,
        imageUrl,
      };
    }),
  );

  return storyboardPayloadSchema.parse({
    styleBrief,
    frames,
  });
}
