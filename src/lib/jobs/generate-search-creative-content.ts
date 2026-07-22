import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  Product,
  ProductIntelligence,
  SearchCopyPayload,
  SearchKeywordsPayload,
} from "@/domain";
import {
  searchCopyPayloadSchema,
  searchKeywordsPayloadSchema,
} from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import { CREATIVE_TEXT_MODEL } from "@/lib/jobs/generate-creative-content";
import { hasAiGateway } from "@/lib/mode";
import { chargeAiUsage } from "@/lib/wallet/gate";

function assertAiGatewayConfigured(): void {
  if (hasAiGateway()) return;
  throw new Error(
    "AI Gateway is not configured for creative generation. " +
      "Set AI_GATEWAY_API_KEY in this environment (and in Trigger.dev → Environment Variables), then retry.",
  );
}

const generatedCopySchema = z.object({
  headlines: z.array(z.string()).min(3).max(15),
  descriptions: z.array(z.string()).min(2).max(4),
  path1: z.string(),
  path2: z.string(),
  finalUrl: z.string().optional(),
  angle: z.string(),
});

const generatedKeywordsSchema = z.object({
  themes: z
    .array(
      z.object({
        phrase: z.string(),
        matchType: z.enum(["broad", "phrase", "exact"]),
        intent: z.string(),
      }),
    )
    .min(3)
    .max(20),
  negatives: z.array(z.string()).max(20),
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

function slugPath(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 15);
}

export async function generateSearchCopy(opts: {
  brief: string;
  product: Product;
  intelligence?: ProductIntelligence | null;
  workspaceId: string;
  userId: string | null;
}): Promise<SearchCopyPayload> {
  assertAiGatewayConfigured();

  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedCopySchema }),
    system: `You write Responsive Search Ad (RSA) copy for DTC products on Google Search.

Rules:
- headlines: 8–15 unique headlines, each ≤30 characters. Mix benefits, features, offers, and brand. No duplicate wording.
- descriptions: 2–4 descriptions, each ≤90 characters. Concrete, scannable benefits — not fluff.
- path1 / path2: optional display URL paths, each ≤15 characters (lowercase slug words, no spaces). Empty string if unused.
- finalUrl: omit unless the brief clearly includes a real https URL; never invent domains.
- angle: one sentence explaining the search intent / messaging strategy.
- No banned claims, invented discounts, or competitor trademark stuffing.
- Write for people actively searching — intent-led, not awareness fluff.`,
    prompt: `Create RSA search ad copy for this product.

Product:
${productContext(opts.product)}${intelligenceContext(opts.intelligence)}

Creative brief:
${opts.brief.trim() || `Search ads for ${opts.product.title}`}`,
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
    throw new Error("Search copy model returned no structured output.");
  }

  const headlines = [
    ...new Set(raw.headlines.map((h) => clip(h, 30)).filter(Boolean)),
  ].slice(0, 15);
  while (headlines.length < 3) {
    headlines.push(clip(opts.product.title, 30));
  }

  const descriptions = raw.descriptions
    .map((d) => clip(d, 90))
    .filter(Boolean)
    .slice(0, 4);
  while (descriptions.length < 2) {
    descriptions.push(
      clip(opts.product.description || opts.product.title, 90),
    );
  }

  const path1 = clip(raw.path1 || slugPath(opts.product.title), 15);
  const path2 = clip(raw.path2 || "", 15);

  let finalUrl: string | undefined;
  if (raw.finalUrl?.trim()) {
    try {
      finalUrl = new URL(raw.finalUrl.trim()).toString();
    } catch {
      finalUrl = undefined;
    }
  }

  return searchCopyPayloadSchema.parse({
    headlines,
    descriptions,
    path1,
    path2,
    finalUrl,
    angle: raw.angle.trim() || `Search ads for ${opts.product.title}`,
  });
}

export async function generateSearchKeywords(opts: {
  copy: SearchCopyPayload;
  brief: string;
  product: Product;
  intelligence?: ProductIntelligence | null;
  workspaceId: string;
  userId: string | null;
  revisionFeedback?: string | null;
}): Promise<SearchKeywordsPayload> {
  assertAiGatewayConfigured();

  const feedback = opts.revisionFeedback?.trim();
  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedKeywordsSchema }),
    system: `You plan Google Search keyword themes for Responsive Search Ads.

Rules:
- themes: 8–15 keyword themes. Phrase is the keyword text (no match-type punctuation).
- matchType: broad | phrase | exact — diversify; favor phrase/exact for high-intent product terms.
- intent: short note on what the searcher wants.
- negatives: 3–10 negative keywords to avoid waste (generic, wrong intent, DIY, free, jobs, etc. when relevant).
- Align with the RSA angle and product; no competitor brand trademarks unless in the brief.
- Prefer commercial / transactional intent over pure research.`,
    prompt: `Build a keyword plan for this search creative.

Product:
${productContext(opts.product)}${intelligenceContext(opts.intelligence)}

Creative brief:
${opts.brief.trim() || `Search ads for ${opts.product.title}`}

RSA angle:
${opts.copy.angle}

Sample headlines:
${opts.copy.headlines.slice(0, 5).join("\n")}
${feedback ? `\nRevision notes:\n${feedback}` : ""}`,
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
    throw new Error("Search keywords model returned no structured output.");
  }

  const themes = raw.themes
    .map((t) => ({
      phrase: clip(t.phrase, 80),
      matchType: t.matchType,
      intent: clip(t.intent || "Commercial intent", 200),
    }))
    .filter((t) => t.phrase.length > 0)
    .slice(0, 20);

  while (themes.length < 3) {
    themes.push({
      phrase: clip(opts.product.title, 80),
      matchType: "phrase" as const,
      intent: "Brand / product search",
    });
  }

  return searchKeywordsPayloadSchema.parse({
    themes,
    negatives: [
      ...new Set(raw.negatives.map((n) => clip(n, 80)).filter(Boolean)),
    ].slice(0, 20),
  });
}
