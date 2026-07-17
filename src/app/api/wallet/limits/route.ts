import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { isWalletAiGateEnabled } from "@/lib/wallet/gate";
import {
  getWalletBlockedReason,
  getWalletWriteRepository,
  nextMonthResetIso,
} from "@/repositories";

export const runtime = "nodejs";

const bodySchema = z.object({
  adSpendLimitCents: z.number().int().nonnegative().nullable().optional(),
  usageLimitCents: z.number().int().nonnegative().nullable().optional(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const repo = getWalletWriteRepository();
  const current = await repo.ensureWallet(active.workspace.id);
  const wallet = await repo.updateLimits(active.workspace.id, {
    adSpendLimitCents:
      parsed.data.adSpendLimitCents !== undefined
        ? parsed.data.adSpendLimitCents
        : current.adSpendLimitCents,
    usageLimitCents:
      parsed.data.usageLimitCents !== undefined
        ? parsed.data.usageLimitCents
        : current.usageLimitCents,
  });

  const blockedReason = isWalletAiGateEnabled()
    ? getWalletBlockedReason(wallet)
    : null;
  return NextResponse.json({
    wallet: {
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
      canManage: true,
    },
  });
}
