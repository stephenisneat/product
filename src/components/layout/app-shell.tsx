"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import type { AppUser, WorkspaceRole } from "@/domain";
import { AppHeader } from "@/components/layout/app-header";
import { AgentContextProvider } from "@/features/agent/agent-context";
import { FeedbackContextMenu } from "@/features/feedback/feedback-context-menu";
import { FeedbackProvider } from "@/features/feedback/feedback-context";
import { WalletProvider, useWallet } from "@/features/wallet/wallet-context";
import { UpgradeProvider } from "@/features/billing/upgrade-context";
import {
  CatalogHeaderActionsProvider,
  isCatalogNavPath,
} from "@/features/products/catalog-toolbar";
import { AppSidebar, APP_NAV_PREFETCH_HREFS } from "@/components/layout/app-sidebar";
import { VisualizationDraftProvider } from "@/features/visualizer/visualization-draft-context";
import { rememberSettingsReturnPath } from "@/features/settings/return-path";
import type { WorkspaceWithRole } from "@/repositories/types";

const AgentComposer = dynamic(
  () =>
    import("@/features/agent/agent-composer").then((m) => m.AgentComposer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full flex-col rounded-xl border border-border bg-canvas">
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="flex-1" />
        <div className="border-t border-border p-3">
          <div className="h-20 animate-pulse rounded-lg bg-muted/30" />
        </div>
      </div>
    ),
  },
);

const BuyCreditsDialog = dynamic(
  () =>
    import("@/features/wallet/wallet-dialogs").then((m) => m.BuyCreditsDialog),
  { ssr: false },
);

function WalletBuyCreditsHost() {
  const { wallet, openBuyCredits, setOpenBuyCredits } = useWallet();
  if (!wallet || !openBuyCredits) return null;
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
  isPlatformAdmin,
  children,
}: {
  user: AppUser;
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
  isPlatformAdmin: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [catalogActionsNode, setCatalogActionsNode] =
    useState<HTMLElement | null>(null);
  const showCatalogNav = isCatalogNavPath(pathname);

  useEffect(() => {
    rememberSettingsReturnPath(
      `${window.location.pathname}${window.location.search}`,
    );
  }, [pathname]);

  useEffect(() => {
    if (!showCatalogNav) setCatalogActionsNode(null);
  }, [showCatalogNav]);

  // Warm catalog RSC payloads on idle so the first tab click is often a cache hit.
  useEffect(() => {
    let cancelled = false;
    const prefetchAll = () => {
      if (cancelled) return;
      for (const href of APP_NAV_PREFETCH_HREFS) {
        void router.prefetch(href);
      }
    };

    const ric = window.requestIdleCallback?.(prefetchAll, { timeout: 2500 });
    const timeout =
      ric === undefined ? window.setTimeout(prefetchAll, 400) : undefined;

    return () => {
      cancelled = true;
      if (ric !== undefined) window.cancelIdleCallback?.(ric);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <FeedbackProvider>
      <FeedbackContextMenu className="flex h-svh flex-col overflow-hidden bg-black">
        <AppHeader
          user={user}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeRole={activeRole}
          isPlatformAdmin={isPlatformAdmin}
        />
        <div className="flex min-h-0 flex-1 gap-2 pr-3 pb-3 pl-0">
          <AppSidebar workspaceId={activeWorkspaceId} />
          <VisualizationDraftProvider>
            <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-canvas">
              <CatalogHeaderActionsProvider actionsNode={catalogActionsNode}>
                {showCatalogNav ? (
                  <>
                    <div className="absolute top-0 z-10 flex h-12 w-full items-center border-b border-border bg-canvas/95 px-4 backdrop-blur supports-backdrop-filter:bg-canvas/80">
                      <div
                        ref={setCatalogActionsNode}
                        className="ml-auto flex w-full flex-wrap items-center justify-end gap-2"
                      />
                    </div>
                    <div className="absolute inset-x-0 top-12 bottom-0 min-h-0 overflow-hidden">
                      {children}
                    </div>
                  </>
                ) : (
                  children
                )}
              </CatalogHeaderActionsProvider>
            </main>
            <aside className="relative hidden min-h-0 w-[360px] shrink-0 overflow-visible lg:block xl:w-[400px]">
              <AgentComposer user={user} workspaceId={activeWorkspaceId} />
            </aside>
          </VisualizationDraftProvider>
        </div>
        <WalletBuyCreditsHost />
      </FeedbackContextMenu>
    </FeedbackProvider>
  );
}

export function AppShell({
  user,
  workspaces = [],
  activeWorkspaceId = null,
  activeRole = null,
  isPlatformAdmin = false,
  children,
}: {
  user: AppUser;
  workspaces?: WorkspaceWithRole[];
  activeWorkspaceId?: string | null;
  activeRole?: WorkspaceRole | null;
  isPlatformAdmin?: boolean;
  children: ReactNode;
}) {
  return (
    <WalletProvider>
      <UpgradeProvider>
        <AgentContextProvider>
          <AppShellFrame
            user={user}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            activeRole={activeRole}
            isPlatformAdmin={isPlatformAdmin}
          >
            {children}
          </AppShellFrame>
        </AgentContextProvider>
      </UpgradeProvider>
    </WalletProvider>
  );
}
