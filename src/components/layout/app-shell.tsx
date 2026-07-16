"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppUser, WorkspaceRole } from "@/domain";
import { AppHeader } from "@/components/layout/app-header";
import { AgentComposer } from "@/features/agent/agent-composer";
import { AgentContextProvider } from "@/features/agent/agent-context";
import { WalletBlockedBanner } from "@/features/wallet/wallet-blocked-banner";
import { WalletProvider, useWallet } from "@/features/wallet/wallet-context";
import { BuyCreditsDialog } from "@/features/wallet/wallet-dialogs";
import type { WorkspaceWithRole } from "@/repositories/types";

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
  workspaces,
  activeWorkspaceId,
  activeRole,
  children,
}: {
  user: AppUser;
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideChatSidebar =
    pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-black">
      <WalletBlockedBanner />
      <AppHeader
        user={user}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeRole={activeRole}
      />
      <div className="flex min-h-0 flex-1 gap-2 px-3 pb-3">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-y-contain rounded-xl border border-border bg-card">
          {children}
        </main>
        {hideChatSidebar ? null : (
          <aside className="hidden min-h-0 w-[360px] shrink-0 lg:block xl:w-[400px]">
            <AgentComposer user={user} />
          </aside>
        )}
      </div>
      <WalletBuyCreditsHost />
    </div>
  );
}

export function AppShell({
  user,
  workspaces = [],
  activeWorkspaceId = null,
  activeRole = null,
  children,
}: {
  user: AppUser;
  workspaces?: WorkspaceWithRole[];
  activeWorkspaceId?: string | null;
  activeRole?: WorkspaceRole | null;
  children: ReactNode;
}) {
  return (
    <WalletProvider>
      <AgentContextProvider>
        <AppShellFrame
          user={user}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeRole={activeRole}
        >
          {children}
        </AppShellFrame>
      </AgentContextProvider>
    </WalletProvider>
  );
}
