import type { WorkspacePlan, WorkspaceWallet } from "@/domain";
import { getEntitlements } from "@/lib/billing/entitlements";
import { hasServiceRole } from "@/lib/supabase/service";
import { maybeTriggerAutoReload } from "@/lib/stripe/auto-reload";
import { billedCostCents } from "@/lib/stripe/pricing";
import {
  getWalletBlockedReason,
  getWalletWriteRepository,
} from "@/repositories";
import { getWorkspaceWriteRepository } from "@/repositories/workspace-write";

/** AI Gateway model id (`provider/model`). */
const CHAT_MODEL = "openai/gpt-4.1-mini";

/**
 * Credit-balance / usage-limit gates for AI.
 * Disabled locally (`next dev`) and when the service role key is unset,
 * so development is not blocked by empty wallets.
 */
export function isWalletAiGateEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return false;
  return hasServiceRole();
}

export type WalletGateResult =
  | { ok: true; wallet: WorkspaceWallet; plan: WorkspacePlan }
  | {
      ok: false;
      response: Response;
    };

async function resolveWorkspacePlan(workspaceId: string): Promise<WorkspacePlan> {
  const repo = getWorkspaceWriteRepository();
  const workspace = await repo.getWorkspace(workspaceId);
  return workspace?.plan ?? "free";
}

export async function assertWalletAllowsAi(
  workspaceId: string,
): Promise<WalletGateResult> {
  if (!isWalletAiGateEnabled()) {
    // Local/dev or unmetered: allow AI without credit balance checks.
    return {
      ok: true,
      plan: "free",
      wallet: {
        workspaceId,
        stripeCustomerId: null,
        balanceCents: 1,
        currency: "usd",
        adSpendLimitCents: null,
        usageLimitCents: null,
        usageMtdCents: 0,
        adSpendMtdCents: 0,
        mtdPeriodStart: new Date().toISOString().slice(0, 10),
        autoReloadEnabled: false,
        autoReloadThresholdCents: null,
        autoReloadTargetCents: null,
        stripeDefaultPaymentMethodId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const plan = await resolveWorkspacePlan(workspaceId);
  const repo = getWalletWriteRepository();
  const wallet = await repo.ensureWallet(workspaceId);
  const reason = getWalletBlockedReason(wallet, plan);
  if (reason) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Wallet blocked",
          code: "wallet_blocked",
          reason,
          plan,
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, wallet, plan };
}

export async function chargeAiUsage(input: {
  workspaceId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}): Promise<void> {
  if (!isWalletAiGateEnabled()) return;

  const plan = await resolveWorkspacePlan(input.workspaceId);
  const ents = getEntitlements(plan);
  const model = input.model ?? CHAT_MODEL;
  const cents = billedCostCents({
    model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    markup: ents.aiMarkup,
  });
  if (cents <= 0) return;

  const repo = getWalletWriteRepository();
  try {
    await repo.ensureWallet(input.workspaceId);
    await repo.chargeAiUsage({
      workspaceId: input.workspaceId,
      amountCents: cents,
      includedAllotmentCents: ents.includedUsageCents,
      allowOverage: ents.allowUsageTopOff,
      description: `AI usage (${model})`,
      metadata: {
        model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        markup: ents.aiMarkup,
        plan,
      },
      createdBy: input.userId,
    });
    const wallet = await repo.getWallet(input.workspaceId);
    if (wallet && ents.allowUsageTopOff) {
      void maybeTriggerAutoReload(wallet).catch((err) => {
        console.error("[wallet] auto-reload failed", err);
      });
    }
  } catch (err) {
    console.error("[wallet] failed to debit AI usage", err);
  }
}

export { CHAT_MODEL };
