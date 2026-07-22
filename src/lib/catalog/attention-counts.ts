import { getEntitlements } from "@/lib/billing/entitlements";
import {
  getCreativeRepository,
  getInsightRepository,
} from "@/repositories";

export type CatalogAttentionCounts = {
  products: number;
  insights: number;
  creatives: number;
};

/** Items awaiting user attention per catalog nav section. */
export async function getCatalogAttentionCounts(
  workspaceId: string,
  plan: string | null | undefined,
): Promise<CatalogAttentionCounts> {
  const hasInsights = getEntitlements(plan ?? "free").hasInsights;

  const creativesRepo = await getCreativeRepository();
  const creatives = await creativesRepo.countByWorkspace(
    workspaceId,
    "awaiting_review",
  );

  if (!hasInsights) {
    return { products: 0, insights: 0, creatives };
  }

  const insightsRepo = await getInsightRepository();
  const [pendingInsights, insights] = await Promise.all([
    insightsRepo.listByWorkspace(workspaceId, {
      status: ["awaiting_review", "revising", "generating"],
      limit: 1000,
    }),
    insightsRepo.countByWorkspace(workspaceId, "awaiting_review"),
  ]);

  const productIds = new Set<string>();
  for (const insight of pendingInsights) {
    if (insight.productId) productIds.add(insight.productId);
  }

  return {
    products: productIds.size,
    insights,
    creatives,
  };
}
