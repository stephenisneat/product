import type { WorkspaceWallet } from "@/domain";
import { getStripe } from "@/lib/stripe/client";
import { getWalletWriteRepository } from "@/repositories";

/**
 * If auto-reload is enabled and balance is at/below threshold, charge the
 * default payment method to bring balance up to the target.
 */
export async function maybeTriggerAutoReload(
  wallet: WorkspaceWallet,
): Promise<void> {
  if (!wallet.autoReloadEnabled) return;
  if (!wallet.stripeCustomerId || !wallet.stripeDefaultPaymentMethodId) return;
  if (
    wallet.autoReloadThresholdCents == null ||
    wallet.autoReloadTargetCents == null
  ) {
    return;
  }
  if (wallet.balanceCents > wallet.autoReloadThresholdCents) return;

  const topUp = wallet.autoReloadTargetCents - wallet.balanceCents;
  if (topUp <= 0) return;

  const stripe = getStripe();
  await stripe.paymentIntents.create({
    amount: topUp,
    currency: wallet.currency || "usd",
    customer: wallet.stripeCustomerId,
    payment_method: wallet.stripeDefaultPaymentMethodId,
    off_session: true,
    confirm: true,
    metadata: {
      workspace_id: wallet.workspaceId,
      purpose: "auto_reload",
      credit_amount_cents: String(topUp),
    },
  });
}

/** Sync default payment method id from Stripe customer onto the wallet row. */
export async function syncDefaultPaymentMethod(
  workspaceId: string,
  customerId: string,
): Promise<void> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const pm =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : (customer.invoice_settings?.default_payment_method?.id ?? null);

  const repo = getWalletWriteRepository();
  await repo.setDefaultPaymentMethod(workspaceId, pm);
}
