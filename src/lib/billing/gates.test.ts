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

  it("allows Hobby campaigns up to 10 and creatives up to 3", () => {
    expect(() => assertCanSpendAndLaunch("hobby")).not.toThrow();
    expect(() => assertCanCreateCampaign("hobby", 9)).not.toThrow();
    expect(() => assertCanCreateCampaign("hobby", 10)).toThrow(
      /10 campaigns/,
    );
    expect(() => assertCanCreateCreative("hobby", 2)).not.toThrow();
    expect(() => assertCanCreateCreative("hobby", 3)).toThrow(
      /3 creatives/,
    );
    expect(() => assertHasInsights("hobby")).toThrow(PlanEntitlementError);
  });

  it("allows Pro unlimited campaigns, creatives, and insights", () => {
    expect(() => assertCanSpendAndLaunch("pro")).not.toThrow();
    expect(() => assertCanCreateCampaign("pro", 1000)).not.toThrow();
    expect(() => assertCanCreateCreative("pro", 1000)).not.toThrow();
    expect(() => assertHasInsights("pro")).not.toThrow();
  });
});
