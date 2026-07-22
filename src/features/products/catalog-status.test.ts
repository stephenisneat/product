import { describe, expect, it } from "vitest";
import type { Campaign } from "@/domain";
import { resolveCatalogStatus } from "./catalog-status";

function campaign(
  status: Campaign["status"],
  overrides: Partial<Campaign> = {},
): Campaign {
  return {
    id: "c1",
    productId: "p1",
    name: "Campaign",
    status,
    channels: [],
    objective: "awareness",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveCatalogStatus", () => {
  it("prioritizes needs attention over campaign state", () => {
    expect(resolveCatalogStatus([campaign("active")], true)).toBe(
      "needs_attention",
    );
  });

  it("marks products with active campaigns as active", () => {
    expect(resolveCatalogStatus([campaign("active")], false)).toBe("active");
    expect(
      resolveCatalogStatus([campaign("draft"), campaign("active")], false),
    ).toBe("active");
  });

  it("marks draft-only products as queued", () => {
    expect(resolveCatalogStatus([campaign("draft")], false)).toBe("queued");
  });

  it("marks paused (ran before, no active) as completed", () => {
    expect(resolveCatalogStatus([campaign("paused")], false)).toBe("completed");
    expect(
      resolveCatalogStatus([campaign("paused"), campaign("draft")], false),
    ).toBe("completed");
  });

  it("marks products with no campaigns as inactive", () => {
    expect(resolveCatalogStatus([], false)).toBe("inactive");
  });
});
