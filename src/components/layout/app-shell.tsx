"use client";

import type { ReactNode } from "react";
import type { AppUser } from "@/domain";
import { AgentComposer } from "@/features/agent/agent-composer";
import { AgentContextProvider } from "@/features/agent/agent-context";
import { WalletBlockedBanner } from "@/features/wallet/wallet-blocked-banner";
import { WalletProvider, useWallet } from "@/features/wallet/wallet-context";
import { BuyCreditsDialog } from "@/features/wallet/wallet-dialogs";

function WalletBuyCreditsHost() {
  const { wallet, openBuyCredits, setOpenBuyCredits } = useWallet();
  if (!wallet) return null;
  return (
    <BuyCreditsDialog
      open={openBuyCredits}
      onOpenChange={setOpenBuyCredits}
      wallet={wallet}
    />
  );
}

function AppShellFrame({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <WalletBlockedBanner />
      <div className="mx-auto flex min-h-0 w-full flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
        <aside className="hidden min-h-0 w-[360px] shrink-0 lg:block xl:w-[400px]">
          <div className="mr-3 mt-3 mb-3 h-[calc(100%-1.5rem)]">
            <AgentComposer user={user} />
          </div>
        </aside>
      </div>
      <WalletBuyCreditsHost />
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  return (
    <WalletProvider>
      <AgentContextProvider>
        <AppShellFrame user={user}>{children}</AppShellFrame>
      </AgentContextProvider>
    </WalletProvider>
  );
}
