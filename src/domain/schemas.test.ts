import { describe, expect, it, beforeEach } from "vitest";
import { productSchema, artifactSchema } from "@/domain";
import { isDemoMode, hasOpenAI } from "@/lib/mode";
import { resetDemoStore } from "@/lib/demo/store";
import { DemoProductRepository, DemoArtifactRepository } from "@/repositories/demo";
import { seedProducts } from "@/lib/demo/seed";
import {
  createDemoSessionToken,
  verifyDemoSessionToken,
} from "@/lib/auth/demo-session";

describe("domain schemas", () => {
  it("parses a seed product", () => {
    const parsed = productSchema.parse(seedProducts[0]);
    expect(parsed.handle).toBe("aurora-insulated-bottle");
  });

  it("rejects empty product titles", () => {
    expect(() =>
      productSchema.parse({
        ...seedProducts[0],
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
  it("detects demo mode without supabase env", () => {
    expect(isDemoMode()).toBe(true);
  });

  it("reports missing openai by default", () => {
    expect(hasOpenAI()).toBe(false);
  });
});

describe("demo session", () => {
  it("round-trips a signed token", () => {
    const token = createDemoSessionToken("demo-user");
    expect(verifyDemoSessionToken(token)).toBe(true);
    expect(verifyDemoSessionToken("tampered.token.value")).toBe(false);
  });
});

describe("demo repositories", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("lists products for the demo owner", async () => {
    const repo = new DemoProductRepository();
    const products = await repo.listProducts("demo-user");
    expect(products.length).toBeGreaterThanOrEqual(4);
  });

  it("creates and approves an artifact path via update", async () => {
    const artifacts = new DemoArtifactRepository();
    const now = new Date().toISOString();
    const created = await artifacts.create({
      id: "art_test",
      productId: "prod_aurora_bottle",
      type: "campaign_concept",
      status: "proposed",
      title: "Summer push",
      summary: "Concept draft",
      payload: { name: "Summer", objective: "Sales", channels: ["meta"], angles: ["heat"] },
      createdBy: "test",
      createdAt: now,
      updatedAt: now,
    });
    const updated = await artifacts.update({
      ...created,
      status: "approved",
      updatedAt: now,
    });
    expect(updated.status).toBe("approved");
  });

  it("upserts intelligence", async () => {
    const products = new DemoProductRepository();
    const now = new Date().toISOString();
    const saved = await products.upsertIntelligence({
      productId: "prod_aurora_bottle",
      positioning: "Updated positioning",
      audience: "Pros",
      valueProps: ["A"],
      objections: ["B"],
      tone: "Clear",
      updatedAt: now,
    });
    expect(saved.positioning).toBe("Updated positioning");
    const loaded = await products.getIntelligence("prod_aurora_bottle");
    expect(loaded?.positioning).toBe("Updated positioning");
  });
});
