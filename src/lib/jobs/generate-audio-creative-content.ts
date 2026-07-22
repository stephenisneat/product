import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  AudioPayload,
  AudioScriptPayload,
  Product,
  ProductIntelligence,
} from "@/domain";
import { audioPayloadSchema, audioScriptPayloadSchema } from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import { CREATIVE_TEXT_MODEL } from "@/lib/jobs/generate-creative-content";
import {
  createCreativeVoiceCast,
  synthesizeSceneAudio,
} from "@/lib/media/elevenlabs";
import { assertElevenLabsConfigured } from "@/lib/media/env";
import { hasAiGateway } from "@/lib/mode";
import { chargeAiUsage } from "@/lib/wallet/gate";

function assertAiGatewayConfigured(): void {
  if (hasAiGateway()) return;
  throw new Error(
    "AI Gateway is not configured for creative generation. " +
      "Set AI_GATEWAY_API_KEY in this environment (and in Trigger.dev → Environment Variables), then retry.",
  );
}

const generatedScriptSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  fullScript: z.string(),
  targetDurationSec: z.number(),
  voiceDirection: z.string(),
  musicBed: z.string(),
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

function intelligenceContext(
  intelligence: ProductIntelligence | null | undefined,
): string {
  if (!intelligence) return "";
  const bits = [
    intelligence.positioning?.trim()
      ? `Positioning: ${intelligence.positioning.trim()}`
      : null,
    intelligence.audience?.trim()
      ? `Audience: ${intelligence.audience.trim()}`
      : null,
    intelligence.tone?.trim() ? `Tone: ${intelligence.tone.trim()}` : null,
    intelligence.valueProps.length > 0
      ? `Value props: ${intelligence.valueProps.join("; ")}`
      : null,
    intelligence.objections.length > 0
      ? `Objections: ${intelligence.objections.join("; ")}`
      : null,
  ].filter(Boolean);
  return bits.length > 0 ? `\n\nBrand intelligence:\n${bits.join("\n")}` : "";
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

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function buildFullScript(hook: string, body: string, cta: string): string {
  return [hook, body, cta]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

export async function generateAudioScript(opts: {
  brief: string;
  product: Product;
  intelligence?: ProductIntelligence | null;
  workspaceId: string;
  userId: string | null;
}): Promise<AudioScriptPayload> {
  assertAiGatewayConfigured();

  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedScriptSchema }),
    system: `You write short-form audio ads (podcast/streaming/radio spots) for DTC products.

Rules:
- hook: first 1–2 sentences that stop the scroll / catch the ear (≤280 chars).
- body: benefit-led story, concrete and conversational (≤1200 chars).
- cta: clear next step with brand/product name (≤280 chars).
- fullScript: speakable script combining hook, body, and cta with natural pauses (blank lines). No stage directions, no [music], no SSML.
- targetDurationSec: realistic spoken length, typically 15–45 seconds (max 60).
- voiceDirection: casting notes — age range, energy, pacing, accent hints (no celebrity names).
- musicBed: optional bed description (genre/mood) or empty string. Do not invent licensed track titles.
- No banned claims or invented discounts. Write for the ear, not the page.`,
    prompt: `Create an audio ad script for this product.

Product:
${productContext(opts.product)}${intelligenceContext(opts.intelligence)}

Creative brief:
${opts.brief.trim() || `Audio ads for ${opts.product.title}`}`,
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
    throw new Error("Audio script model returned no structured output.");
  }

  const hook = clip(raw.hook || opts.product.title, 280);
  const body = clip(
    raw.body || opts.product.description || opts.product.title,
    1200,
  );
  const cta = clip(raw.cta || `Learn more about ${opts.product.title}.`, 280);
  const fullScript = clip(
    raw.fullScript.trim() || buildFullScript(hook, body, cta),
    2000,
  );
  const duration = Number.isFinite(raw.targetDurationSec)
    ? Math.min(120, Math.max(8, Math.round(raw.targetDurationSec)))
    : 30;

  return audioScriptPayloadSchema.parse({
    hook,
    body,
    cta,
    fullScript,
    targetDurationSec: duration,
    voiceDirection: clip(
      raw.voiceDirection || "Warm, confident narrator; natural pacing.",
      500,
    ),
    musicBed: clip(raw.musicBed || "", 500),
  });
}

export async function generateAudioSpot(opts: {
  script: AudioScriptPayload;
  workspaceId: string;
  creativeId: string;
}): Promise<AudioPayload> {
  assertElevenLabsConfigured();

  const spoken = opts.script.fullScript.trim();
  if (!spoken) {
    throw new Error("Audio script is empty.");
  }

  const cast = await createCreativeVoiceCast({
    creativeId: opts.creativeId,
    scenes: [
      {
        id: "spot",
        heading: "AUDIO SPOT",
        action: opts.script.voiceDirection,
        dialogue: spoken,
        spokenKind: "voiceover",
        character: "",
        durationSec: opts.script.targetDurationSec,
      },
    ],
  });

  const url = await synthesizeSceneAudio({
    text: spoken,
    voiceId: cast.voiceoverId,
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    sceneId: "spot",
  });

  if (!url) {
    throw new Error("Audio spot synthesis returned no file.");
  }

  return audioPayloadSchema.parse({
    url,
    durationSec: opts.script.targetDurationSec,
    voiceId: cast.voiceoverId,
    transcript: spoken,
  });
}
