import type Stripe from "stripe";
import type { BillingInterval, WorkspacePlan } from "@/domain";
import { clampSeatCount, isPaidPlan } from "@/lib/billing/entitlements";
import {
  planFromStripePriceId,
  planFromSubscriptionMetadata,
} from "@/lib/stripe/subscription-prices";
import { getWorkspaceWriteRepository } from "@/repositories/workspace-write";

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function seatsFromSubscription(sub: Stripe.Subscription): number {
  const qty = sub.items.data[0]?.quantity;
  return clampSeatCount(typeof qty === "number" ? qty : 1);
}

export async function syncWorkspaceSubscription(
  sub: Stripe.Subscription,
): Promise<void> {
  const workspaceId = sub.metadata?.workspace_id;
  if (!workspaceId) {
    console.warn("[stripe] subscription missing workspace_id metadata", sub.id);
    return;
  }

  const repo = getWorkspaceWriteRepository();
  const workspace = await repo.getWorkspace(workspaceId);
  if (!workspace) {
    console.warn("[stripe] workspace not found for subscription", workspaceId);
    return;
  }

  const status = sub.status;
  const isActive =
    status === "active" || status === "trialing" || status === "past_due";

  let plan: WorkspacePlan = "free";
  let interval: BillingInterval | null = null;

  if (isActive) {
    const fromPrice = planFromStripePriceId(priceIdFromSubscription(sub));
    if (fromPrice) {
      plan = fromPrice.plan;
      interval = fromPrice.interval;
    } else {
      const resolved = planFromSubscriptionMetadata(
        sub.metadata as Record<string, string>,
        priceIdFromSubscription(sub),
      );
      plan = isPaidPlan(resolved.plan) ? resolved.plan : "free";
      interval = resolved.interval;
    }
  }

  await repo.updateWorkspace(workspaceId, {
    plan,
    billingInterval: isActive ? interval : null,
    billedSeats: isActive ? seatsFromSubscription(sub) : 1,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: status,
  });
}

export async function clearWorkspaceSubscription(input: {
  workspaceId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const repo = getWorkspaceWriteRepository();
  const workspaceId = input.workspaceId ?? null;

  if (!workspaceId && input.subscriptionId) {
    return;
  }
  if (!workspaceId) return;

  await repo.updateWorkspace(workspaceId, {
    plan: "free",
    billingInterval: null,
    billedSeats: 1,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: "canceled",
  });
}
