import { describe, expect, it, vi } from "vitest";
import { PlanEntitlementError } from "@/lib/billing/gates";
import {
  assertCanLinkCreativesToCampaigns,
  normalizeCampaignIds,
} from "@/lib/campaigns/associate";

describe("normalizeCampaignIds", () => {
  it("merges singular and array, dedupes, and drops empties", () => {
    expect(
      normalizeCampaignIds({
        campaignIds: ["a", "b", "a", ""],
        campaignId: "c",
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("returns empty when nothing provided", () => {
    expect(normalizeCampaignIds({})).toEqual([]);
    expect(normalizeCampaignIds({ campaignIds: [], campaignId: "  " })).toEqual(
      [],
    );
  });
});

describe("assertCanLinkCreativesToCampaigns", () => {
  it("gates Free even with no campaigns", async () => {
    await expect(
      assertCanLinkCreativesToCampaigns({
        plan: "free",
        campaignIds: [],
        countByCampaign: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(PlanEntitlementError);
  });

  it("checks each campaign count on Growth", async () => {
    const countByCampaign = vi.fn(async (id: string) =>
      id === "full" ? 3 : 0,
    );

    await expect(
      assertCanLinkCreativesToCampaigns({
        plan: "growth",
        campaignIds: ["ok", "full"],
        countByCampaign,
      }),
    ).rejects.toBeInstanceOf(PlanEntitlementError);

    await expect(
      assertCanLinkCreativesToCampaigns({
        plan: "growth",
        campaignIds: ["ok"],
        countByCampaign,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not double-count already linked campaigns", async () => {
    const countByCampaign = vi.fn(async () => 3);
    await expect(
      assertCanLinkCreativesToCampaigns({
        plan: "growth",
        campaignIds: ["existing"],
        alreadyLinked: ["existing"],
        countByCampaign,
      }),
    ).resolves.toBeUndefined();
  });
});
