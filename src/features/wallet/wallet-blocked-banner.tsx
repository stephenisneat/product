"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/features/wallet/wallet-context";

export function WalletBlockedBanner() {
  const { wallet, setOpenBuyCredits } = useWallet();

  if (!wallet?.blocked) return null;

  const message =
    wallet.blockedReason === "usage_limit"
      ? "You've reached this workspace's monthly AI usage limit. Raise the limit or wait until it resets."
      : "Your wallet balance is $0. Add credits to keep using AI features.";

  return (
    <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>{message}</p>
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
      </div>
    </div>
  );
}
