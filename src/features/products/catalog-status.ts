import type { Campaign } from "@/domain";

export type CatalogStatus =
  | "needs_attention"
  | "active"
  | "queued"
  | "completed"
  | "inactive";

export const CATALOG_STATUS_ORDER: CatalogStatus[] = [
  "needs_attention",
  "active",
  "queued",
  "completed",
  "inactive",
];

export const CATALOG_STATUS_LABELS: Record<CatalogStatus, string> = {
  needs_attention: "Needs attention",
  active: "Active",
  queued: "Queued",
  completed: "Completed",
  inactive: "Inactive",
};

/**
 * Classifies a product for the catalog groups.
 * Priority: needs attention → active campaigns → completed (ran before) →
 * queued (draft only) → inactive.
 */
export function resolveCatalogStatus(
  campaigns: Campaign[],
  needsAttention: boolean,
): CatalogStatus {
  if (needsAttention) return "needs_attention";

  const hasActive = campaigns.some((c) => c.status === "active");
  if (hasActive) return "active";

  const hasPaused = campaigns.some((c) => c.status === "paused");
  if (hasPaused) return "completed";

  const hasDraft = campaigns.some((c) => c.status === "draft");
  if (hasDraft) return "queued";

  return "inactive";
}
