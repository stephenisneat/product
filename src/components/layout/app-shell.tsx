"use client";

import type { ReactNode } from "react";
import type { AppUser } from "@/domain";
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen">
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="hidden w-[360px] shrink-0 lg:block xl:w-[400px]">
          <div className="sticky top-3 mr-3 mb-3 h-[calc(100vh-1.5rem)]">
            <AgentComposer
              key={contextKey}
              user={user}
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
