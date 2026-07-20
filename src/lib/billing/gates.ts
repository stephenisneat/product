import type { WorkspacePlan } from "@/domain";
import { getEntitlements } from "@/lib/billing/entitlements";

export class PlanEntitlementError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 403) {
    super(message);
    this.name = "PlanEntitlementError";
    this.code = code;
    this.status = status;
  }
}

export function assertCanSpendAndLaunch(plan: WorkspacePlan): void {
  const ents = getEntitlements(plan);
  if (!ents.canSpendAndLaunch) {
    throw new PlanEntitlementError(
      "Ad spend and campaign launch require Growth or Pro. Upgrade to continue.",
      "plan_upgrade_required",
    );
  }
}

export function assertCanCreateCampaign(
  plan: WorkspacePlan,
  currentCount: number,
): void {
  const ents = getEntitlements(plan);
  if (!ents.canSpendAndLaunch || ents.maxCampaignsPerProduct === 0) {
    throw new PlanEntitlementError(
      "Saving and launching campaigns requires Growth or Pro.",
      "plan_upgrade_required",
    );
  }
  if (
    ents.maxCampaignsPerProduct != null &&
    currentCount >= ents.maxCampaignsPerProduct
  ) {
    throw new PlanEntitlementError(
      `Growth allows ${ents.maxCampaignsPerProduct} campaigns per product. Upgrade to Pro for unlimited.`,
      "campaign_limit_reached",
    );
  }
}

export function assertCanCreateCreative(
  plan: WorkspacePlan,
  currentCount: number,
): void {
  const ents = getEntitlements(plan);
  if (ents.maxCreativesPerCampaign === 0) {
    throw new PlanEntitlementError(
      "Creatives require Growth or Pro. Upgrade to continue.",
      "plan_upgrade_required",
    );
  }
  if (
    ents.maxCreativesPerCampaign != null &&
    currentCount >= ents.maxCreativesPerCampaign
  ) {
    throw new PlanEntitlementError(
      `Growth allows ${ents.maxCreativesPerCampaign} creatives per campaign. Upgrade to Pro for unlimited.`,
      "creative_limit_reached",
    );
  }
}

export function assertHasInsights(plan: WorkspacePlan): void {
  if (!getEntitlements(plan).hasInsights) {
    throw new PlanEntitlementError(
      "Insights require the Pro plan.",
      "plan_upgrade_required",
    );
  }
}
