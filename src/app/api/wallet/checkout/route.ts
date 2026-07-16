import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { getAppUrl, getStripe, hasStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import {
  CREDIT_MAX_CENTS,
  CREDIT_MIN_CENTS,
} from "@/lib/stripe/pricing";
import { getWalletWriteRepository } from "@/repositories";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(CREDIT_MIN_CENTS)
    .max(CREDIT_MAX_CENTS),
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
  if (!canManageMembers(active.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amountCents } = parsed.data;
  const repo = getWalletWriteRepository();
  const { customerId } = await ensureStripeCustomer(
    active.workspace,
    user.email,
    repo,
  );

  const appUrl = getAppUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Wallet credits",
            description: `Add $${(amountCents / 100).toFixed(2)} to your workspace wallet`,
          },
        },
      },
    ],
    success_url: `${appUrl}/?wallet=credits_added`,
    cancel_url: `${appUrl}/?wallet=cancelled`,
    metadata: {
      workspace_id: active.workspace.id,
      credit_amount_cents: String(amountCents),
      user_id: user.id,
    },
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: {
        workspace_id: active.workspace.id,
        purpose: "credit_purchase",
        credit_amount_cents: String(amountCents),
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
