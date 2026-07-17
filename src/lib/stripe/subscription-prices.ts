import type { WorkspacePlan } from "@/domain";
import type { BillingInterval, PaidPlan } from "@/lib/billing/entitlements";
import { isPaidPlan } from "@/lib/billing/entitlements";

type PriceKey = `${PaidPlan}_${BillingInterval}`;

const ENV_KEYS: Record<PriceKey, string> = {
  hobby_month: "STRIPE_PRICE_HOBBY",
  hobby_year: "STRIPE_PRICE_HOBBY_ANNUAL",
  pro_month: "STRIPE_PRICE_PRO",
  pro_year: "STRIPE_PRICE_PRO_ANNUAL",
};

/** Stripe Price IDs for subscription plans (Dashboard → Products). */
export function getStripePriceId(
  plan: PaidPlan,
  interval: BillingInterval = "month",
): string | null {
  const key = ENV_KEYS[`${plan}_${interval}`];
  return process.env[key]?.trim() || null;
}

export function planFromStripePriceId(
  priceId: string | null | undefined,
): { plan: PaidPlan; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const [key, envName] of Object.entries(ENV_KEYS) as [
    PriceKey,
    string,
  ][]) {
    const configured = process.env[envName]?.trim();
    if (configured && priceId === configured) {
      const [plan, interval] = key.split("_") as [PaidPlan, BillingInterval];
      return { plan, interval };
    }
  }
  return null;
}

export function planFromSubscriptionMetadata(
  metadata: Record<string, string> | null | undefined,
  priceId?: string | null,
): { plan: WorkspacePlan; interval: BillingInterval | null } {
  const fromPrice = planFromStripePriceId(priceId);
  if (fromPrice) return fromPrice;

  const fromMeta = metadata?.plan;
  if (fromMeta && isPaidPlan(fromMeta as WorkspacePlan)) {
    const interval =
      metadata?.billing_interval === "year" ? "year" : "month";
    return { plan: fromMeta as PaidPlan, interval };
  }
  return { plan: "free", interval: null };
}
