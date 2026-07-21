import { describe, expect, it } from "vitest";
import {
  productSchema,
  createProductInputSchema,
  artifactSchema,
  workspaceSchema,
  workspaceMemberSchema,
} from "@/domain";
import { hasAiGateway } from "@/lib/mode";

const sampleProduct = {
  id: "prod_aurora_bottle",
  title: "Aurora Insulated Bottle",
  handle: "aurora-insulated-bottle",
  description:
    "A double-wall vacuum bottle built for all-day temperature control with a leak-proof lid and matte finish.",
  status: "active" as const,
  type: "ecommerce" as const,
  metadata: { fulfillmentKind: "physical" as const },
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
  workspaceId: "550e8400-e29b-41d4-a716-446655440000",
};

describe("domain schemas", () => {
  it("parses a sample product", () => {
    const parsed = productSchema.parse(sampleProduct);
    expect(parsed.handle).toBe("aurora-insulated-bottle");
    expect(parsed.workspaceId).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects empty product titles", () => {
    expect(() =>
      productSchema.parse({
        ...sampleProduct,
        title: "",
      }),
    ).toThrow();
  });

  it("parses typed create product input", () => {
    const ecommerce = createProductInputSchema.parse({
      title: "Bottle",
      handle: "bottle",
      type: "ecommerce",
      price: 20,
      metadata: { fulfillmentKind: "digital" },
    });
    expect(ecommerce.type).toBe("ecommerce");
    if (ecommerce.type === "ecommerce") {
      expect(ecommerce.metadata.fulfillmentKind).toBe("digital");
    }

    const website = createProductInputSchema.parse({
      title: "Acme",
      handle: "acme",
      type: "website",
      metadata: { url: "https://acme.com", siteKind: "saas" },
    });
    expect(website.type).toBe("website");
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

  it("parses workspace and membership", () => {
    const workspace = workspaceSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Acme Workspace",
      avatarUrl: "https://www.google.com/s2/favicons?domain=acme.com&sz=128",
      plan: "pro",
      primaryDomain: "acme.com",
      joinDomain: "acme.com",
      domainJoinEnabled: true,
      requireMfa: true,
      createdBy: "user_1",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    });
    expect(workspace.name).toBe("Acme Workspace");
    expect(workspace.plan).toBe("pro");
    expect(workspace.primaryDomain).toBe("acme.com");
    expect(workspace.joinDomain).toBe("acme.com");
    expect(workspace.requireMfa).toBe(true);

    const member = workspaceMemberSchema.parse({
      workspaceId: workspace.id,
      userId: "user_1",
      role: "owner",
      createdAt: "2026-07-14T00:00:00.000Z",
      email: "owner@acme.com",
      name: "Owner",
    });
    expect(member.role).toBe("owner");
  });
});

describe("mode", () => {
  it("reports missing AI Gateway credentials by default", () => {
    expect(hasAiGateway()).toBe(false);
  });
});
