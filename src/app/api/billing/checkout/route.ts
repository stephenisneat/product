import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspace,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import {
  clampSeatCount,
  getEntitlements,
  isPaidPlan,
  type BillingInterval,
  type PaidPlan,
} from "@/lib/billing/entitlements";
import { getAppUrl, getStripe, hasStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { getStripePriceId } from "@/lib/stripe/subscription-prices";
import { getWalletWriteRepository, getWorkspaceRepository } from "@/repositories";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["growth", "pro"]),
  interval: z.enum(["month", "year"]).default("month"),
  seats: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasStripe()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }
  if (!canManageWorkspace(active.role)) {
    return NextResponse.json(
      { error: "Only the workspace owner can change the plan." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const targetPlan = parsed.data.plan as PaidPlan;
  const interval = parsed.data.interval as BillingInterval;
  if (!isPaidPlan(targetPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = getStripePriceId(targetPlan, interval);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Stripe ${interval}ly price for ${getEntitlements(targetPlan).name} is not configured`,
      },
      { status: 503 },
    );
  }

  const wsRepo = await getWorkspaceRepository();
  const members = await wsRepo.listMembers(active.workspace.id);
  const seats = clampSeatCount(
    parsed.data.seats ?? Math.max(members.length, 1),
  );

  const repo = getWalletWriteRepository();
  const { customerId } = await ensureStripeCustomer(
    active.workspace,
    user.email,
    repo,
  );

  const appUrl = getAppUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: seats }],
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
    subscription_data: {
      metadata: {
        workspace_id: active.workspace.id,
        plan: targetPlan,
        billing_interval: interval,
        seats: String(seats),
      },
    },
    metadata: {
      workspace_id: active.workspace.id,
      plan: targetPlan,
      billing_interval: interval,
      seats: String(seats),
      user_id: user.id,
      purpose: "subscription",
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
    seats,
    interval,
  });
}
