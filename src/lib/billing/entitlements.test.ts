import { describe, expect, it } from "vitest";
import {
  HOBBY_AI_MARKUP,
  PRO_AI_MARKUP,
  canUpgradePlan,
  getEntitlements,
  nextUpgradePlan,
} from "@/lib/billing/entitlements";

describe("plan entitlements", () => {
  it("defines Free / Hobby / Pro allotments and prices", () => {
    expect(getEntitlements("free")).toMatchObject({
      priceCents: 0,
      includedUsageCents: 150,
      hasInsights: false,
      maxCampaignsPerProduct: 0,
      canSpendAndLaunch: false,
      allowUsageTopOff: false,
      badgeColor: "yellow",
    });
    expect(getEntitlements("hobby")).toMatchObject({
      priceCents: 900,
      includedUsageCents: 900,
      hasInsights: false,
      maxCampaignsPerProduct: 10,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "blue",
    });
    expect(getEntitlements("pro")).toMatchObject({
      priceCents: 9900,
      includedUsageCents: 9900,
      hasInsights: true,
      maxCampaignsPerProduct: null,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "green",
    });
  });

  it("uses half-margin Pro markup vs Hobby", () => {
    expect(HOBBY_AI_MARKUP).toBe(1.5);
    expect(PRO_AI_MARKUP).toBe(1.25);
    expect(getEntitlements("free").aiMarkup).toBe(1.5);
    expect(getEntitlements("hobby").aiMarkup).toBe(1.5);
    expect(getEntitlements("pro").aiMarkup).toBe(1.25);
  });

  it("resolves upgrade ladder", () => {
    expect(canUpgradePlan("free")).toBe(true);
    expect(canUpgradePlan("hobby")).toBe(true);
    expect(canUpgradePlan("pro")).toBe(false);
    expect(nextUpgradePlan("free")).toBe("hobby");
    expect(nextUpgradePlan("hobby")).toBe("pro");
    expect(nextUpgradePlan("pro")).toBeNull();
  });
});
