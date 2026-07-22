import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  Product,
  ScreenplayPayload,
  WorldCharacter,
  WorldLocation,
  WorldPayload,
} from "@/domain";
import { worldPayloadSchema } from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import {
  CREATIVE_IMAGE_MODEL,
  CREATIVE_TEXT_MODEL,
} from "@/lib/jobs/generate-creative-content";
import { uploadCreativeWorldSheet } from "@/lib/media/creative-assets";
import {
  getElevenLabsDialogueOverride,
  getElevenLabsVoiceoverOverride,
} from "@/lib/media/env";
import { listElevenLabsVoices } from "@/lib/media/elevenlabs";
import { hasAiGateway } from "@/lib/mode";
import {
  buildVoiceCastFromProfiles,
  uniqueDialogueCharacters,
} from "@/lib/media/voice-cast";
import { chargeAiUsage } from "@/lib/wallet/gate";

function assertAiGatewayConfigured(): void {
  if (hasAiGateway()) return;
  throw new Error(
    "AI Gateway is not configured for creative generation. " +
      "Set AI_GATEWAY_API_KEY in this environment (and in Trigger.dev → Environment Variables), then retry.",
  );
}

const plannedCharacterSchema = z.object({
  name: z.string(),
  ageRange: z.string(),
  presentation: z.string(),
  face: z.string(),
  hair: z.string(),
  wardrobe: z.string(),
  distinguishingMarks: z.string(),
  appearanceSummary: z.string(),
});

const plannedLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  interiorExterior: z.enum(["interior", "exterior", "mixed"]),
  timeOfDay: z.string(),
});

const worldPlanSchema = z.object({
  styleBible: z.string(),
  characters: z.array(plannedCharacterSchema),
  locations: z.array(plannedLocationSchema).min(1),
  sceneLocationIds: z.record(z.string(), z.string()),
  productAppearance: z.string(),
  brandLock: z.string(),
  continuityNotes: z.string(),
  styleLockPrompt: z.string(),
  productLockPrompt: z.string(),
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
    product.images.length
      ? `Product photo count: ${product.images.length}`
      : null,
  ].filter(Boolean);
  return bits.join("\n");
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

async function generateWorldSheetImage(opts: {
  prompt: string;
  referenceImageUrls: string[];
  workspaceId: string;
  creativeId: string;
  kind: string;
  userId: string | null;
}): Promise<string> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: URL }
  > = [{ type: "text", text: opts.prompt }];

  for (const url of opts.referenceImageUrls.slice(0, 6)) {
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
    throw new Error(`No image returned for world sheet ${opts.kind}.`);
  }

  return uploadCreativeWorldSheet({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    kind: opts.kind,
    bytes: imageFile.uint8Array,
    contentType: imageFile.mediaType || "image/png",
  });
}

/**
 * Build the reviewable world lookbook: style lock, cast sheets, location plates,
 * product locks, and a persisted ElevenLabs voice cast.
 */
export async function generateWorld(opts: {
  screenplay: ScreenplayPayload;
  product: Product;
  workspaceId: string;
  creativeId: string;
  userId: string | null;
  revisionFeedback?: string | null;
}): Promise<WorldPayload> {
  assertAiGatewayConfigured();

  const characterNames = uniqueDialogueCharacters(opts.screenplay.scenes);
  const sceneDigest = opts.screenplay.scenes
    .map((s) => {
      const spoken = s.dialogue
        ? ` [${s.spokenKind}${s.character ? `:${s.character}` : ""}] "${s.dialogue}"`
        : "";
      return `- ${s.id} | ${s.heading} (${s.durationSec}s)\n  Action: ${s.action}${spoken}`;
    })
    .join("\n");

  const planResult = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: worldPlanSchema }),
    system: `You design a locked visual/audio world for a short product video ad.
Return a cohesive styleBible (grade, lens, palette, lighting) and concrete reference prompts.

Rules:
- characters: one entry per named dialogue character (UPPERCASE names). Include face, hair, wardrobe, marks, and a one-line appearanceSummary used everywhere.
- locations: unique sets derived from scene headings/action. Normalize near-duplicates (e.g. INT. KITCHEN - DAY and CONTINUOUS kitchen → one location).
- sceneLocationIds: map every screenplay scene id to exactly one location id.
- productAppearance + brandLock: describe packaging/logo so stills match real product photos.
- styleLockPrompt: empty/atmosphere establishing plate, no faces, no product hero, landscape 16:9.
- productLockPrompt: clean hero product still matching reference photos, landscape 16:9, no text overlays.
- continuityNotes: short bullet-like string of must-not-change facts.`,
    prompt: `Product:
${productContext(opts.product)}

Screenplay logline: ${opts.screenplay.logline}

Dialogue characters to cast (must include all): ${characterNames.join(", ") || "(none — voiceover-only)"}

Scenes:
${sceneDigest}

${opts.revisionFeedback?.trim() ? `Revision notes: ${opts.revisionFeedback.trim()}` : ""}

Return styleLockPrompt and productLockPrompt as self-contained image prompts.`,
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
    throw new Error("World planner returned no structured output.");
  }

  const styleBible = plan.styleBible.trim();
  const productImages = opts.product.images.filter(Boolean);

  // Generate reference sheets (style + product first so cast/locations can match grade).
  const styleLockUrl = await generateWorldSheetImage({
    prompt: `Create a single landscape 16:9 cinematic style-lock plate (no collage, no text overlays, no watermarks, no people, no hero product).

Style bible: ${styleBible}

${plan.styleLockPrompt}

Empty or lightly atmospheric establishing look that defines grade, lens, and palette.`,
    referenceImageUrls: productImages.slice(0, 2),
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    kind: "style-lock",
    userId: opts.userId,
  });

  const productLockUrl = await generateWorldSheetImage({
    prompt: `Create a single landscape 16:9 product lock still (no collage, no text overlays, no watermarks, no UI chrome).

Style: ${styleBible}
Brand: ${plan.brandLock.trim() || opts.product.title}
Product appearance: ${plan.productAppearance.trim()}

${plan.productLockPrompt}

Match the product's real appearance from the reference photos exactly — do not redesign packaging or logo.`,
    referenceImageUrls: productImages,
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    kind: "product-lock",
    userId: opts.userId,
  });

  // Ensure every dialogue character has a plan entry.
  const plannedByName = new Map(
    plan.characters.map((c) => [c.name.trim().toUpperCase(), c]),
  );
  for (const name of characterNames) {
    if (!plannedByName.has(name)) {
      plannedByName.set(name, {
        name,
        ageRange: "adult",
        presentation: "neutral",
        face: "clear naturalistic features",
        hair: "neat everyday hair",
        wardrobe: "simple contemporary clothing",
        distinguishingMarks: "none",
        appearanceSummary: `${name}, contemporary everyday look`,
      });
    }
  }

  const characterPlans = [...plannedByName.values()].filter((c) =>
    characterNames.includes(c.name.trim().toUpperCase()),
  );

  // Voice cast before sheets so character.voiceId is ready.
  const voices = await listElevenLabsVoices();
  const voiceCastMaps = buildVoiceCastFromProfiles({
    voices,
    profiles: characterPlans.map((c) => ({
      name: c.name.trim().toUpperCase(),
      ageRange: c.ageRange,
      presentation: c.presentation,
      appearanceSummary: c.appearanceSummary,
    })),
    creativeId: opts.creativeId,
    styleHints: styleBible,
    voiceoverOverride: getElevenLabsVoiceoverOverride(),
    dialogueOverride: getElevenLabsDialogueOverride(),
  });

  const characters: WorldCharacter[] = await Promise.all(
    characterPlans.map(async (planned) => {
      const name = planned.name.trim().toUpperCase();
      const appearanceSummary =
        planned.appearanceSummary.trim() ||
        [
          name,
          planned.ageRange,
          planned.presentation,
          planned.face,
          planned.hair,
          planned.wardrobe,
        ]
          .filter(Boolean)
          .join(", ");

      const sheetUrl = await generateWorldSheetImage({
        prompt: `Create a single landscape 16:9 character reference sheet for a commercial ad (no collage, no text overlays, no watermarks).

Style: ${styleBible}
Character name: ${name}
Age: ${planned.ageRange}
Presentation: ${planned.presentation}
Face: ${planned.face}
Hair: ${planned.hair}
Wardrobe: ${planned.wardrobe}
Marks: ${planned.distinguishingMarks}
Summary: ${appearanceSummary}

Neutral standing or mid-shot pose, clear face and full wardrobe visible, plain or lightly dressed set. Match the style lock grade.`,
        referenceImageUrls: [styleLockUrl],
        workspaceId: opts.workspaceId,
        creativeId: opts.creativeId,
        kind: `character-${name.toLowerCase()}`,
        userId: opts.userId,
      });

      const voiceId =
        voiceCastMaps.characterVoices.get(name) ?? voiceCastMaps.voiceoverId;
      const voiceName =
        voiceCastMaps.characterVoiceNames?.get(name) ?? voiceId;

      return {
        name,
        ageRange: planned.ageRange.trim(),
        presentation: planned.presentation.trim(),
        face: planned.face.trim(),
        hair: planned.hair.trim(),
        wardrobe: planned.wardrobe.trim(),
        distinguishingMarks: planned.distinguishingMarks.trim(),
        appearanceSummary,
        sheetUrl,
        voiceId,
        voiceName,
      };
    }),
  );

  // Locations — ensure every scene maps to a valid location.
  let locationsPlan = plan.locations.map((loc, index) => ({
    ...loc,
    id: loc.id.trim() || `loc-${index + 1}`,
    name: loc.name.trim() || `Location ${index + 1}`,
  }));
  if (locationsPlan.length === 0) {
    locationsPlan = [
      {
        id: "loc-1",
        name: "Primary set",
        description: "Neutral contemporary interior matching the style bible.",
        interiorExterior: "mixed" as const,
        timeOfDay: "day",
      },
    ];
  }
  const locationIds = new Set(locationsPlan.map((l) => l.id));
  const fallbackLocId = locationsPlan[0]!.id;
  const sceneLocationIds: Record<string, string> = {};
  for (const scene of opts.screenplay.scenes) {
    const mapped = plan.sceneLocationIds[scene.id]?.trim();
    sceneLocationIds[scene.id] =
      mapped && locationIds.has(mapped) ? mapped : fallbackLocId;
  }

  const locations: WorldLocation[] = await Promise.all(
    locationsPlan.map(async (loc) => {
      const sheetUrl = await generateWorldSheetImage({
        prompt: `Create a single landscape 16:9 location/set reference plate (no collage, no text overlays, no watermarks, no hero product, no recognizable faces).

Style: ${styleBible}
Location: ${loc.name}
Interior/exterior: ${loc.interiorExterior}
Time of day: ${loc.timeOfDay}
Set design: ${loc.description}

Wide establishing plate of the empty or lightly dressed set. Lock architecture, furniture layout, materials, and lighting for continuity.`,
        referenceImageUrls: [styleLockUrl],
        workspaceId: opts.workspaceId,
        creativeId: opts.creativeId,
        kind: `location-${loc.id}`,
        userId: opts.userId,
      });

      return {
        id: loc.id,
        name: loc.name,
        description: loc.description.trim(),
        interiorExterior: loc.interiorExterior,
        timeOfDay: loc.timeOfDay.trim(),
        sheetUrl,
      };
    }),
  );

  const characterVoices: Record<string, string> = {};
  const characterVoiceNames: Record<string, string> = {};
  for (const character of characters) {
    characterVoices[character.name] = character.voiceId;
    characterVoiceNames[character.name] = character.voiceName;
  }

  return worldPayloadSchema.parse({
    styleBible,
    styleLockUrl,
    characters,
    locations,
    sceneLocationIds,
    productAppearance:
      plan.productAppearance.trim() ||
      `${opts.product.title}: match product photos exactly.`,
    productLockUrls: [productLockUrl],
    brandLock: plan.brandLock.trim() || opts.product.title,
    continuityNotes: plan.continuityNotes.trim(),
    voiceCast: {
      voiceoverId: voiceCastMaps.voiceoverId,
      voiceoverName: voiceCastMaps.voiceoverName ?? "",
      characterVoices,
      characterVoiceNames,
    },
  });
}
