import type { WorkspacePlan } from "@/domain";
import { assertCanCreateCreative } from "@/lib/billing/gates";
import { getProductWriteRepository } from "@/repositories";

/**
 * Normalize campaign id inputs from agent/API:
 * accepts campaignIds[], campaignId, or both; dedupes; drops empties.
 */
export function normalizeCampaignIds(input: {
  campaignIds?: string[] | null;
  campaignId?: string | null;
}): string[] {
  const fromArray = (input.campaignIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const singular = input.campaignId?.trim();
  const merged = singular ? [...fromArray, singular] : fromArray;
  return [...new Set(merged)];
}

/**
 * Keep only campaign ids that exist for this product.
 * Agents often invent ids; invalid FKs would fail inserts.
 */
export async function resolveProductCampaignIds(
  productId: string,
  campaignIds: string[],
): Promise<string[]> {
  const requested = [
    ...new Set(campaignIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (requested.length === 0) return [];

  const products = getProductWriteRepository();
  const campaigns = await products.listCampaigns(productId);
  const allowed = new Set(campaigns.map((c) => c.id));
  const valid = requested.filter((id) => allowed.has(id));

  const dropped = requested.filter((id) => !allowed.has(id));
  if (dropped.length > 0) {
    console.warn(
      JSON.stringify({
        context: "resolveProductCampaignIds.invalid_campaign_ids",
        productId,
        dropped,
      }),
    );
  }

  return valid;
}

/**
 * Enforce plan creative caps for each campaign being linked.
 * Empty list still gates Free (max === 0).
 */
export async function assertCanLinkCreativesToCampaigns(opts: {
  plan: WorkspacePlan;
  campaignIds: string[];
  countByCampaign: (campaignId: string) => Promise<number>;
  /** Campaigns the creative is already linked to (excluded from increment check). */
  alreadyLinked?: string[];
  kind?: "video" | "ad_copy";
}): Promise<void> {
  const kind = opts.kind ?? "video";
  if (opts.campaignIds.length === 0) {
    assertCanCreateCreative(opts.plan, 0, kind);
    return;
  }

  const already = new Set(opts.alreadyLinked ?? []);
  for (const campaignId of opts.campaignIds) {
    const count = await opts.countByCampaign(campaignId);
    // Re-linking to an existing campaign shouldn't consume an extra slot.
    const effective = already.has(campaignId) ? Math.max(0, count - 1) : count;
    assertCanCreateCreative(opts.plan, effective, kind);
  }
}
