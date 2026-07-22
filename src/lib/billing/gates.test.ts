import { describe, expect, it } from "vitest";
import {
  PlanEntitlementError,
  assertCanCreateCampaign,
  assertCanCreateCreative,
  assertCanSpendAndLaunch,
  assertHasInsights,
} from "@/lib/billing/gates";

describe("plan gates", () => {
  it("blocks Free from spend/launch and campaigns", () => {
    expect(() => assertCanSpendAndLaunch("free")).toThrow(PlanEntitlementError);
    expect(() => assertCanCreateCampaign("free", 0)).toThrow(
      PlanEntitlementError,
    );
    expect(() => assertCanCreateCreative("free", 0)).toThrow(
      PlanEntitlementError,
    );
    expect(() => assertHasInsights("free")).toThrow(PlanEntitlementError);
  });

  it("allows Growth campaigns up to 10 and creatives up to 3", () => {
    expect(() => assertCanSpendAndLaunch("growth")).not.toThrow();
    expect(() => assertCanCreateCampaign("growth", 9)).not.toThrow();
    expect(() => assertCanCreateCampaign("growth", 10)).toThrow(
      /10 campaigns/,
    );
    expect(() => assertCanCreateCreative("growth", 2)).not.toThrow();
    expect(() => assertCanCreateCreative("growth", 3)).toThrow(
      /3 video creatives/,
    );
    expect(() => assertCanCreateCreative("growth", 3, "ad_copy")).toThrow(
      /3 ad copy/,
    );
    expect(() => assertHasInsights("growth")).toThrow(PlanEntitlementError);
  });

  it("allows Pro unlimited campaigns, creatives, and insights", () => {
    expect(() => assertCanSpendAndLaunch("pro")).not.toThrow();
    expect(() => assertCanCreateCampaign("pro", 1000)).not.toThrow();
    expect(() => assertCanCreateCreative("pro", 1000)).not.toThrow();
    expect(() => assertHasInsights("pro")).not.toThrow();
  });
});
