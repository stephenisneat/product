import type { WorkspacePlan } from "@/domain";
import type { PaidPlan } from "@/lib/billing/entitlements";
import { isPaidPlan } from "@/lib/billing/entitlements";

/** Stripe Price IDs for subscription plans (Dashboard → Products). */
export function getStripePriceId(plan: PaidPlan): string | null {
  if (plan === "hobby") {
    return process.env.STRIPE_PRICE_HOBBY?.trim() || null;
  }
  return process.env.STRIPE_PRICE_PRO?.trim() || null;
}

export function planFromStripePriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const hobby = process.env.STRIPE_PRICE_HOBBY?.trim();
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  if (hobby && priceId === hobby) return "hobby";
  if (pro && priceId === pro) return "pro";
  return null;
}

export function planFromSubscriptionMetadata(
  metadata: Record<string, string> | null | undefined,
  priceId?: string | null,
): WorkspacePlan {
  const fromMeta = metadata?.plan;
  if (fromMeta && isPaidPlan(fromMeta as WorkspacePlan)) {
    return fromMeta as PaidPlan;
  }
  return planFromStripePriceId(priceId) ?? "free";
}
