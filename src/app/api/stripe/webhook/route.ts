import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { syncDefaultPaymentMethod } from "@/lib/stripe/auto-reload";
import { getWalletWriteRepository } from "@/repositories";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "customer.updated":
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe webhook]", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  const workspaceId = session.metadata?.workspace_id;
  const creditCents = Number(session.metadata?.credit_amount_cents ?? 0);
  if (!workspaceId || !Number.isFinite(creditCents) || creditCents <= 0) return;

  const repo = getWalletWriteRepository();
  await repo.ensureWallet(workspaceId);
  await repo.credit({
    workspaceId,
    amountCents: creditCents,
    type: "credit_purchase",
    description: "Credit purchase",
    metadata: {
      checkout_session_id: session.id,
      amount_total: session.amount_total,
    },
    stripeObjectId: session.id,
  });

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (customerId) {
    await syncDefaultPaymentMethod(workspaceId, customerId);
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.purpose !== "auto_reload") return;
  const workspaceId = pi.metadata.workspace_id;
  const creditCents = Number(pi.metadata.credit_amount_cents ?? pi.amount ?? 0);
  if (!workspaceId || !Number.isFinite(creditCents) || creditCents <= 0) return;

  const repo = getWalletWriteRepository();
  await repo.ensureWallet(workspaceId);
  await repo.credit({
    workspaceId,
    amountCents: creditCents,
    type: "auto_reload",
    description: "Auto-reload",
    metadata: { payment_intent_id: pi.id },
    stripeObjectId: pi.id,
  });
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  const workspaceId = customer.metadata?.workspace_id;
  if (!workspaceId) return;
  await syncDefaultPaymentMethod(workspaceId, customer.id);
}
