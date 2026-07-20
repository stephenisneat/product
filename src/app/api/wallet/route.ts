import { NextResponse } from "next/server";
import type { MemberUsage, WalletSummary } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import {
  getEntitlements,
  includedUsageCentsForSeats,
} from "@/lib/billing/entitlements";
import { hasServiceRole } from "@/lib/supabase/service";
import { isWalletAiGateEnabled } from "@/lib/wallet/gate";
import {
  effectiveIncludedAllotmentCents,
  getWalletBlockedReason,
  getWalletWriteRepository,
  getWorkspaceRepository,
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
    const plan = active.workspace.plan ?? "free";
    const seats = active.workspace.billedSeats ?? 1;
    const repo = getWalletWriteRepository();
    const wallet = await repo.ensureWallet(active.workspace.id, {
      plan,
      seats,
    });
    const blockedReason = isWalletAiGateEnabled()
      ? getWalletBlockedReason(wallet, plan, seats)
      : null;
    const ents = getEntitlements(plan);
    const included = effectiveIncludedAllotmentCents(wallet, plan, seats);

    const [usageByUser, workspaceRepo] = await Promise.all([
      repo.sumAiUsageByMember(active.workspace.id, wallet.mtdPeriodStart),
      getWorkspaceRepository(),
    ]);
    const members = await workspaceRepo.listMembers(active.workspace.id);

    const memberUsage: MemberUsage[] = members
      .map((member) => {
        const usage = usageByUser.get(member.userId);
        return {
          userId: member.userId,
          name: member.name ?? null,
          email: member.email ?? null,
          avatarUrl: member.avatarUrl ?? null,
          usageCents: usage?.usageCents ?? 0,
          actionCount: usage?.actionCount ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.usageCents !== a.usageCents) return b.usageCents - a.usageCents;
        const aLabel = (a.name ?? a.email ?? "").toLowerCase();
        const bLabel = (b.name ?? b.email ?? "").toLowerCase();
        return aLabel.localeCompare(bLabel);
      });

    // Include usage from users who left the workspace but still have ledger rows.
    for (const [userId, usage] of usageByUser) {
      if (memberUsage.some((m) => m.userId === userId)) continue;
      memberUsage.push({
        userId,
        name: null,
        email: null,
        avatarUrl: null,
        usageCents: usage.usageCents,
        actionCount: usage.actionCount,
      });
    }

    const summary: WalletSummary = {
      balanceCents: wallet.balanceCents,
      currency: wallet.currency,
      adSpendLimitCents: wallet.adSpendLimitCents,
      usageLimitCents: wallet.usageLimitCents ?? included,
      usageMtdCents: wallet.usageMtdCents,
      adSpendMtdCents: wallet.adSpendMtdCents,
      actionsMtd: wallet.actionsMtd,
      includedRolloverCents: wallet.includedRolloverCents,
      includedActions: ents.includedActions,
      resetsOn: nextMonthResetIso(wallet.mtdPeriodStart),
      autoReloadEnabled: wallet.autoReloadEnabled,
      autoReloadThresholdCents: wallet.autoReloadThresholdCents,
      autoReloadTargetCents: wallet.autoReloadTargetCents,
      hasPaymentMethod: Boolean(wallet.stripeDefaultPaymentMethodId),
      blocked: blockedReason != null,
      blockedReason,
      canManage: canManageMembers(active.role),
    };

    return NextResponse.json({
      wallet: summary,
      memberUsage,
      currentUserId: user.id,
      plan,
      seats,
      billingInterval: active.workspace.billingInterval ?? null,
      entitlements: {
        includedUsageCents: includedUsageCentsForSeats(plan, seats),
        includedRolloverCents: wallet.includedRolloverCents,
        effectiveIncludedCents: included,
        includedActions: ents.includedActions,
        allowUsageTopOff: ents.allowUsageTopOff,
        allowIncludedRollover: ents.allowIncludedRollover,
        aiMarkup: ents.aiMarkup,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load wallet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
