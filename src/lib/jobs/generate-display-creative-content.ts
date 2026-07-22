import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  DisplayAssetsPayload,
  DisplayConceptPayload,
  Product,
  ProductIntelligence,
} from "@/domain";
import {
  displayAssetsPayloadSchema,
  displayConceptPayloadSchema,
} from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import {
  CREATIVE_IMAGE_MODEL,
  CREATIVE_TEXT_MODEL,
} from "@/lib/jobs/generate-creative-content";
import { uploadDisplayCreativeImage } from "@/lib/media/creative-assets";
import { hasAiGateway } from "@/lib/mode";
import { chargeAiUsage } from "@/lib/wallet/gate";

function assertAiGatewayConfigured(): void {
  if (hasAiGateway()) return;
  throw new Error(
    "AI Gateway is not configured for creative generation. " +
      "Set AI_GATEWAY_API_KEY in this environment (and in Trigger.dev → Environment Variables), then retry.",
  );
}

const generatedConceptSchema = z.object({
  headlines: z.array(z.string()).min(1).max(5),
  longHeadline: z.string(),
  descriptions: z.array(z.string()).min(1).max(5),
  businessName: z.string(),
  styleBrief: z.string(),
  imagePrompts: z.object({
    marketing: z.string(),
    square: z.string(),
  }),
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

export async function generateDisplayConcept(opts: {
  brief: string;
  product: Product;
  intelligence?: ProductIntelligence | null;
  workspaceId: string;
  userId: string | null;
}): Promise<DisplayConceptPayload> {
  assertAiGatewayConfigured();

  const result = await generateText({
    model: CREATIVE_TEXT_MODEL,
    output: Output.object({ schema: generatedConceptSchema }),
    system: `You write Responsive Display Ad (RDA) creative concepts for DTC products.

Rules:
- headlines: 3–5 short headlines, each ≤30 characters. Punchy, benefit-led, no clickbait spam.
- longHeadline: one longer headline ≤90 characters.
- descriptions: 2–5 descriptions, each ≤90 characters. Concrete benefits, not fluff.
- businessName: brand / seller name ≤25 characters (use product title if no brand is clear).
- styleBrief: visual direction for the photos (lighting, setting, mood, color). No text-in-image instructions beyond "no text overlays".
- imagePrompts.marketing: detailed prompt for a landscape ~1.91:1 marketing still (scene, subject, product placement).
- imagePrompts.square: detailed prompt for a 1:1 square marketing still (same product, complementary crop/composition).
- No banned claims or invented discounts. Match the product's real appearance.`,
    prompt: `Create a display ad concept for this product.

Product:
${productContext(opts.product)}${intelligenceContext(opts.intelligence)}

Creative brief:
${opts.brief.trim() || `Display ads for ${opts.product.title}`}`,
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
    throw new Error("Display concept model returned no structured output.");
  }

  const payload: DisplayConceptPayload = {
    headlines: raw.headlines.map((h) => clip(h, 30)).filter(Boolean).slice(0, 5),
    longHeadline: clip(raw.longHeadline, 90),
    descriptions: raw.descriptions
      .map((d) => clip(d, 90))
      .filter(Boolean)
      .slice(0, 5),
    businessName: clip(raw.businessName || opts.product.title, 25),
    styleBrief: raw.styleBrief.trim(),
    imagePrompts: {
      marketing: raw.imagePrompts.marketing.trim(),
      square: raw.imagePrompts.square.trim(),
    },
  };

  if (payload.headlines.length === 0) {
    payload.headlines = [clip(opts.product.title, 30)];
  }
  if (payload.descriptions.length === 0) {
    payload.descriptions = [
      clip(opts.product.description || opts.product.title, 90),
    ];
  }

  return displayConceptPayloadSchema.parse(payload);
}

async function generateDisplayStill(opts: {
  styleBrief: string;
  imagePrompt: string;
  aspectLabel: string;
  aspectHint: string;
  product: Product;
  workspaceId: string;
  creativeId: string;
  variant: "marketing" | "square";
  userId: string | null;
}): Promise<string> {
  const productImage = opts.product.images[0];
  const textPrompt = `Create a single ${opts.aspectLabel} commercial marketing still (${opts.aspectHint}). No collage, no text overlays, no watermarks, no UI chrome, no logos drawn in.

Style: ${opts.styleBrief}

Shot: ${opts.imagePrompt}

Product: ${opts.product.title}
${opts.product.description?.trim() ? `Product context: ${opts.product.description.trim().slice(0, 400)}` : ""}

Photoreal or polished commercial still. Match the product's real appearance if a reference image is provided.`;

  const result = await generateText({
    model: CREATIVE_IMAGE_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: textPrompt },
          ...(productImage
            ? ([
                {
                  type: "image" as const,
                  image: new URL(productImage),
                },
              ] as const)
            : []),
        ],
      },
    ],
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
    throw new Error(`No image returned for ${opts.variant} asset.`);
  }

  return uploadDisplayCreativeImage({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    variant: opts.variant,
    bytes: imageFile.uint8Array,
    contentType: imageFile.mediaType || "image/png",
  });
}

export async function generateDisplayAssets(opts: {
  concept: DisplayConceptPayload;
  product: Product;
  workspaceId: string;
  creativeId: string;
  userId: string | null;
  revisionFeedback?: string | null;
}): Promise<DisplayAssetsPayload> {
  assertAiGatewayConfigured();

  const feedback = opts.revisionFeedback?.trim();
  const styleBrief = feedback
    ? `${opts.concept.styleBrief}\n\nRevision notes: ${feedback}`
    : opts.concept.styleBrief;

  const [marketingImageUrl, squareImageUrl] = await Promise.all([
    generateDisplayStill({
      styleBrief,
      imagePrompt: opts.concept.imagePrompts.marketing,
      aspectLabel: "landscape 1.91:1",
      aspectHint: "wide horizontal marketing image, roughly 1200×628",
      product: opts.product,
      workspaceId: opts.workspaceId,
      creativeId: opts.creativeId,
      variant: "marketing",
      userId: opts.userId,
    }),
    generateDisplayStill({
      styleBrief,
      imagePrompt: opts.concept.imagePrompts.square,
      aspectLabel: "square 1:1",
      aspectHint: "square marketing image, roughly 1200×1200",
      product: opts.product,
      workspaceId: opts.workspaceId,
      creativeId: opts.creativeId,
      variant: "square",
      userId: opts.userId,
    }),
  ]);

  return displayAssetsPayloadSchema.parse({
    marketingImageUrl,
    squareImageUrl,
  });
}
