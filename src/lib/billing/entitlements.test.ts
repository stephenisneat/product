import { describe, expect, it } from "vitest";
import {
  ANNUAL_DISCOUNT,
  HOBBY_AI_MARKUP,
  PRO_AI_MARKUP,
  canUpgradePlan,
  effectiveMonthlyCentsPerSeat,
  getEntitlements,
  includedUsageCentsForSeats,
  nextUpgradePlan,
  priceCentsPerSeat,
} from "@/lib/billing/entitlements";

describe("plan entitlements", () => {
  it("defines Free / Hobby / Pro allotments and per-seat prices", () => {
    expect(getEntitlements("free")).toMatchObject({
      priceCentsPerSeatMonthly: 0,
      includedUsageCentsPerSeat: 150,
      includedActions: 100,
      hasInsights: false,
      maxCampaignsPerProduct: 0,
      maxCreativesPerCampaign: 0,
      canSpendAndLaunch: false,
      allowUsageTopOff: true,
      allowIncludedRollover: true,
      badgeColor: "yellow",
    });
    expect(getEntitlements("hobby")).toMatchObject({
      priceCentsPerSeatMonthly: 900,
      includedUsageCentsPerSeat: 900,
      includedActions: null,
      hasInsights: false,
      maxCampaignsPerProduct: 10,
      maxCreativesPerCampaign: 3,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "blue",
    });
    expect(getEntitlements("pro")).toMatchObject({
      priceCentsPerSeatMonthly: 9900,
      includedUsageCentsPerSeat: 9900,
      hasInsights: true,
      maxCampaignsPerProduct: null,
      maxCreativesPerCampaign: null,
      canSpendAndLaunch: true,
      allowUsageTopOff: true,
      badgeColor: "green",
    });
  });

  it("uses pass-through Pro markup vs Hobby", () => {
    expect(HOBBY_AI_MARKUP).toBe(1.5);
    expect(PRO_AI_MARKUP).toBe(1.0);
    expect(getEntitlements("pro").aiMarkup).toBe(1.0);
  });

  it("applies 20% annual discount and scales included usage by seats", () => {
    expect(ANNUAL_DISCOUNT).toBe(0.2);
    expect(priceCentsPerSeat("hobby", "month")).toBe(900);
    expect(priceCentsPerSeat("hobby", "year")).toBe(Math.round(900 * 12 * 0.8));
    expect(effectiveMonthlyCentsPerSeat("hobby")).toBe(
      Math.round((900 * 12 * 0.8) / 12),
    );
    expect(includedUsageCentsForSeats("hobby", 3)).toBe(2700);
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
