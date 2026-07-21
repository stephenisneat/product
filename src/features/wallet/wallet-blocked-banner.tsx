"use client";

import { XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useUpgradeOptional } from "@/features/billing/upgrade-context";
import { useWallet } from "@/features/wallet/wallet-context";

export function WalletBlockedBanner() {
  const {
    wallet,
    setOpenBuyCredits,
    blockedBannerDismissed,
    dismissBlockedBanner,
  } = useWallet();
  const upgrade = useUpgradeOptional();

  if (!wallet?.blocked || blockedBannerDismissed) return null;

  const message =
    wallet.blockedReason === "usage_limit"
      ? "You've used this workspace's included AI allotment for the month. Upgrade or wait until it resets."
      : "Your wallet balance is $0. Add credits to keep using AI features.";

  return (
    <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">{message}</p>
        <div className="flex items-center gap-1">
          {wallet.canManage && wallet.blockedReason === "zero_balance" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-600/40 bg-background"
              onClick={() => setOpenBuyCredits(true)}
            >
              Buy credits
            </Button>
          ) : null}
          {wallet.canManage && wallet.blockedReason === "usage_limit" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-600/40 bg-background"
              onClick={() => upgrade?.openUpgrade()}
            >
              Upgrade
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-amber-950 hover:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/20"
            onClick={dismissBlockedBanner}
            aria-label="Dismiss warning"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
