import type { Workspace } from "@/domain";
import { getStripe } from "@/lib/stripe/client";
import {
  getWalletWriteRepository,
  type SupabaseWalletRepository,
} from "@/repositories";

export async function ensureStripeCustomer(
  workspace: Workspace,
  repo: SupabaseWalletRepository = getWalletWriteRepository(),
): Promise<{ wallet: Awaited<ReturnType<SupabaseWalletRepository["ensureWallet"]>>; customerId: string }> {
  const wallet = await repo.ensureWallet(workspace.id);
  if (wallet.stripeCustomerId) {
    return { wallet, customerId: wallet.stripeCustomerId };
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: workspace.name,
    metadata: {
      workspace_id: workspace.id,
    },
  });

  const updated = await repo.setStripeCustomerId(workspace.id, customer.id);
  return { wallet: updated, customerId: customer.id };
}
