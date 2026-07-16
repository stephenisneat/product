import type { Workspace } from "@/domain";
import { getStripe } from "@/lib/stripe/client";
import {
  getWalletWriteRepository,
  type SupabaseWalletRepository,
} from "@/repositories";

export async function ensureStripeCustomer(
  workspace: Workspace,
  email: string,
  repo: SupabaseWalletRepository = getWalletWriteRepository(),
): Promise<{ wallet: Awaited<ReturnType<SupabaseWalletRepository["ensureWallet"]>>; customerId: string }> {
  const wallet = await repo.ensureWallet(workspace.id);
  const stripe = getStripe();

  if (wallet.stripeCustomerId) {
    const existing = await stripe.customers.retrieve(wallet.stripeCustomerId);
    if (!existing.deleted && !existing.email) {
      await stripe.customers.update(wallet.stripeCustomerId, { email });
    }
    return { wallet, customerId: wallet.stripeCustomerId };
  }

  const customer = await stripe.customers.create({
    name: workspace.name,
    email,
    metadata: {
      workspace_id: workspace.id,
    },
  });

  const updated = await repo.setStripeCustomerId(workspace.id, customer.id);
  return { wallet: updated, customerId: customer.id };
}
