"use client";

import type { ReactNode } from "react";
import type { AppUser } from "@/domain";
import { AppHeader } from "@/components/layout/app-header";
import { AgentComposer } from "@/features/agent/agent-composer";
import {
  AgentContextProvider,
  useAgentContext,
} from "@/features/agent/agent-context";

function AppShellFrame({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  const { route, contextKey } = useAgentContext();
  const productTitle =
    route.mode === "product" ? route.productTitle : undefined;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} productTitle={productTitle} />
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1600px]">
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="hidden w-[360px] shrink-0 lg:block xl:w-[400px]">
          <div className="sticky top-12 h-[calc(100vh-3rem)]">
            <AgentComposer
              key={contextKey}
              productId={route.mode === "product" ? route.productId : undefined}
              productTitle={
                route.mode === "product" ? route.productTitle : undefined
              }
            />
          </div>
        </aside>
      </div>
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
    <AgentContextProvider>
      <AppShellFrame user={user}>{children}</AppShellFrame>
    </AgentContextProvider>
  );
}
