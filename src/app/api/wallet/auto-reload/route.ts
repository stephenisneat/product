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

const bodySchema = z
  .object({
    enabled: z.boolean(),
    thresholdCents: z.number().int().nonnegative().nullable().optional(),
    targetCents: z.number().int().positive().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.enabled) return;
    if (val.thresholdCents == null || val.targetCents == null) {
      ctx.addIssue({
        code: "custom",
        message: "thresholdCents and targetCents are required when enabling",
      });
      return;
    }
    if (val.targetCents <= val.thresholdCents) {
      ctx.addIssue({
        code: "custom",
        message: "targetCents must be greater than thresholdCents",
      });
    }
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

  const plan = active.workspace.plan ?? "free";
  const seats = active.workspace.billedSeats ?? 1;
  const repo = getWalletWriteRepository();
  const current = await repo.ensureWallet(active.workspace.id, { plan, seats });

  if (parsed.data.enabled && !current.stripeDefaultPaymentMethodId) {
    return NextResponse.json(
      {
        error:
          "No payment method on file. Add one from Payment methods first.",
      },
      { status: 400 },
    );
  }

  const wallet = await repo.updateAutoReload(active.workspace.id, {
    enabled: parsed.data.enabled,
    thresholdCents: parsed.data.enabled
      ? (parsed.data.thresholdCents ?? null)
      : (parsed.data.thresholdCents ?? current.autoReloadThresholdCents),
    targetCents: parsed.data.enabled
      ? (parsed.data.targetCents ?? null)
      : (parsed.data.targetCents ?? current.autoReloadTargetCents),
  });

  const blockedReason = isWalletAiGateEnabled()
    ? getWalletBlockedReason(wallet, plan, seats)
    : null;
  return NextResponse.json({
    wallet: {
      balanceCents: wallet.balanceCents,
      currency: wallet.currency,
      adSpendLimitCents: wallet.adSpendLimitCents,
      usageLimitCents: wallet.usageLimitCents,
      usageMtdCents: wallet.usageMtdCents,
      adSpendMtdCents: wallet.adSpendMtdCents,
      actionsMtd: wallet.actionsMtd,
      includedRolloverCents: wallet.includedRolloverCents,
      includedActions: null,
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
