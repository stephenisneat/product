import type Stripe from "stripe";
import type { WorkspacePlan } from "@/domain";
import { isPaidPlan } from "@/lib/billing/entitlements";
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

function activePaidPlan(sub: Stripe.Subscription): WorkspacePlan {
  const priceId = priceIdFromSubscription(sub);
  return planFromSubscriptionMetadata(
    sub.metadata as Record<string, string>,
    priceId,
  );
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
  if (isActive) {
    const resolved = activePaidPlan(sub);
    plan = isPaidPlan(resolved) ? resolved : "free";
  }

  // Prefer price id when metadata is stale after plan changes in portal.
  if (isActive) {
    const fromPrice = planFromStripePriceId(priceIdFromSubscription(sub));
    if (fromPrice) plan = fromPrice;
  }

  await repo.updateWorkspace(workspaceId, {
    plan,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: status,
  });
}

export async function clearWorkspaceSubscription(input: {
  workspaceId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const repo = getWorkspaceWriteRepository();
  let workspaceId = input.workspaceId ?? null;

  if (!workspaceId && input.subscriptionId) {
    // Look up by scanning is expensive; metadata should always be present.
    // Fallback: leave plan as-is if we can't resolve.
    return;
  }
  if (!workspaceId) return;

  await repo.updateWorkspace(workspaceId, {
    plan: "free",
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: "canceled",
  });
}
