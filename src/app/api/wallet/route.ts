import { NextResponse } from "next/server";
import type { WalletSummary } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getWalletBlockedReason,
  getWalletWriteRepository,
  nextMonthResetIso,
} from "@/repositories";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Wallet service is not configured" },
      { status: 503 },
    );
  }

  try {
    const repo = getWalletWriteRepository();
    const wallet = await repo.ensureWallet(active.workspace.id);
    const blockedReason = getWalletBlockedReason(wallet);

    const summary: WalletSummary = {
      balanceCents: wallet.balanceCents,
      currency: wallet.currency,
      adSpendLimitCents: wallet.adSpendLimitCents,
      usageLimitCents: wallet.usageLimitCents,
      usageMtdCents: wallet.usageMtdCents,
      adSpendMtdCents: wallet.adSpendMtdCents,
      resetsOn: nextMonthResetIso(wallet.mtdPeriodStart),
      autoReloadEnabled: wallet.autoReloadEnabled,
      autoReloadThresholdCents: wallet.autoReloadThresholdCents,
      autoReloadTargetCents: wallet.autoReloadTargetCents,
      hasPaymentMethod: Boolean(wallet.stripeDefaultPaymentMethodId),
      blocked: blockedReason != null,
      blockedReason,
      canManage: canManageMembers(active.role),
    };

    return NextResponse.json({ wallet: summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load wallet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
