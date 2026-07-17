import type { WorkspacePlan } from "@/domain";
import {
  PlanEntitlementError,
  assertCanSpendAndLaunch,
} from "@/lib/billing/gates";
import { getWalletWriteRepository } from "@/repositories";

/** Debit ad spend from the wallet; Free / locked plans are rejected. */
export async function chargeAdSpend(input: {
  workspaceId: string;
  plan: WorkspacePlan;
  amountCents: number;
  userId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  assertCanSpendAndLaunch(input.plan);

  if (input.amountCents <= 0) {
    throw new PlanEntitlementError("Ad spend amount must be positive", "invalid_amount", 400);
  }

  const repo = getWalletWriteRepository();
  await repo.ensureWallet(input.workspaceId);
  await repo.debit({
    workspaceId: input.workspaceId,
    amountCents: input.amountCents,
    type: "ad_spend",
    description: input.description ?? "Ad spend",
    metadata: input.metadata,
    createdBy: input.userId ?? null,
  });
}
