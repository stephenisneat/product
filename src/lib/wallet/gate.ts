import type { WorkspaceWallet } from "@/domain";
import { hasServiceRole } from "@/lib/supabase/service";
import { maybeTriggerAutoReload } from "@/lib/stripe/auto-reload";
import { billedCostCents } from "@/lib/stripe/pricing";
import {
  getWalletBlockedReason,
  getWalletWriteRepository,
} from "@/repositories";

/** AI Gateway model id (`provider/model`). */
const CHAT_MODEL = "openai/gpt-4.1-mini";

export type WalletGateResult =
  | { ok: true; wallet: WorkspaceWallet }
  | {
      ok: false;
      response: Response;
    };

export async function assertWalletAllowsAi(
  workspaceId: string,
): Promise<WalletGateResult> {
  if (!hasServiceRole()) {
    // Without service role we cannot meter; allow AI so local/dev still works.
    return {
      ok: true,
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

  const repo = getWalletWriteRepository();
  const wallet = await repo.ensureWallet(workspaceId);
  const reason = getWalletBlockedReason(wallet);
  if (reason) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Wallet blocked",
          code: "wallet_blocked",
          reason,
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, wallet };
}

export async function chargeAiUsage(input: {
  workspaceId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}): Promise<void> {
  if (!hasServiceRole()) return;

  const model = input.model ?? CHAT_MODEL;
  const cents = billedCostCents({
    model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });
  if (cents <= 0) return;

  const repo = getWalletWriteRepository();
  try {
    await repo.debit({
      workspaceId: input.workspaceId,
      amountCents: cents,
      type: "ai_usage",
      description: `AI usage (${model})`,
      metadata: {
        model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        markup: 1.5,
      },
      createdBy: input.userId,
    });
    const wallet = await repo.getWallet(input.workspaceId);
    if (wallet) {
      void maybeTriggerAutoReload(wallet).catch((err) => {
        console.error("[wallet] auto-reload failed", err);
      });
    }
  } catch (err) {
    console.error("[wallet] failed to debit AI usage", err);
  }
}

export { CHAT_MODEL };
