import { describe, expect, it } from "vitest";
import { productSchema, artifactSchema } from "@/domain";
import { hasOpenAI } from "@/lib/mode";

const sampleProduct = {
  id: "prod_aurora_bottle",
  title: "Aurora Insulated Bottle",
  handle: "aurora-insulated-bottle",
  description:
    "A double-wall vacuum bottle built for all-day temperature control with a leak-proof lid and matte finish.",
  status: "active" as const,
  price: 48,
  currency: "USD",
  images: [
    "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
  ],
  channels: ["shopify", "meta", "google"],
  sku: "AUR-750-BLK",
  category: "Drinkware",
  syncedAt: "2026-07-10T16:00:00.000Z",
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-07-10T16:00:00.000Z",
  ownerId: "user_1",
};

describe("domain schemas", () => {
  it("parses a sample product", () => {
    const parsed = productSchema.parse(sampleProduct);
    expect(parsed.handle).toBe("aurora-insulated-bottle");
  });

  it("rejects empty product titles", () => {
    expect(() =>
      productSchema.parse({
        ...sampleProduct,
        title: "",
      }),
    ).toThrow();
  });

  it("parses artifacts", () => {
    const artifact = artifactSchema.parse({
      id: "art_1",
      productId: "prod_1",
      type: "ad_copy",
      status: "proposed",
      title: "Test",
      summary: "Summary",
      payload: { headline: "Hi" },
      createdBy: "agent",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    });
    expect(artifact.type).toBe("ad_copy");
  });
});

describe("mode", () => {
  it("reports missing openai by default", () => {
    expect(hasOpenAI()).toBe(false);
  });
});
