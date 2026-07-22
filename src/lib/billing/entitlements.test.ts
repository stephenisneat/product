import { describe, expect, it } from "vitest";
import type { WorkspacePlan } from "@/domain";
import {
  ANNUAL_DISCOUNT,
  GROWTH_AI_MARKUP,
  PRO_AI_MARKUP,
  canUpgradePlan,
  effectiveMonthlyCentsPerSeat,
  getEntitlements,
  includedUsageCentsForSeats,
  nextUpgradePlan,
  normalizeWorkspacePlan,
  priceCentsPerSeat,
} from "@/lib/billing/entitlements";

describe("plan entitlements", () => {
  it("defines Free / Growth / Pro allotments and per-seat prices", () => {
    expect(getEntitlements("free")).toMatchObject({
      priceCentsPerSeatMonthly: 0,
      includedUsageCentsPerSeat: 150,
      includedActions: 100,
      hasInsights: false,
      maxCampaignsPerProduct: 0,
      maxVideoCreativesPerCampaign: 0,
      maxAdCopyPerCampaign: 0,
      canSpendAndLaunch: false,
      allowUsageTopOff: true,
      allowIncludedRollover: true,
      badgeColor: "yellow",
    });
    expect(getEntitlements("growth")).toMatchObject({
      priceCentsPerSeatMonthly: 2900,
      includedUsageCentsPerSeat: 2900,
      includedActions: null,
      hasInsights: false,
      maxCampaignsPerProduct: 10,
      maxVideoCreativesPerCampaign: 3,
      maxAdCopyPerCampaign: 3,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "blue",
    });
    expect(getEntitlements("pro")).toMatchObject({
      priceCentsPerSeatMonthly: 9900,
      includedUsageCentsPerSeat: 9900,
      hasInsights: true,
      maxCampaignsPerProduct: null,
      maxVideoCreativesPerCampaign: null,
      maxAdCopyPerCampaign: null,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "green",
    });
  });

  it("maps legacy hobby plan ids to Growth entitlements", () => {
    expect(normalizeWorkspacePlan("hobby")).toBe("growth");
    expect(getEntitlements("hobby" as WorkspacePlan)).toMatchObject({
      plan: "growth",
      maxVideoCreativesPerCampaign: 3,
      canSpendAndLaunch: true,
    });
  });

  it("uses pass-through Pro markup vs Growth", () => {
    expect(GROWTH_AI_MARKUP).toBe(1.5);
    expect(PRO_AI_MARKUP).toBe(1.0);
    expect(getEntitlements("pro").aiMarkup).toBe(1.0);
  });

  it("applies 20% annual discount and scales included usage by seats", () => {
    expect(ANNUAL_DISCOUNT).toBe(0.2);
    expect(priceCentsPerSeat("growth", "month")).toBe(2900);
    expect(priceCentsPerSeat("growth", "year")).toBe(
      Math.round(2900 * 12 * 0.8),
    );
    expect(effectiveMonthlyCentsPerSeat("growth")).toBe(
      Math.round((2900 * 12 * 0.8) / 12),
    );
    expect(includedUsageCentsForSeats("growth", 3)).toBe(8700);
  });

  it("resolves upgrade ladder", () => {
    expect(canUpgradePlan("free")).toBe(true);
    expect(canUpgradePlan("growth")).toBe(true);
    expect(canUpgradePlan("pro")).toBe(false);
    expect(nextUpgradePlan("free")).toBe("growth");
    expect(nextUpgradePlan("growth")).toBe("pro");
    expect(nextUpgradePlan("pro")).toBeNull();
  });
});
