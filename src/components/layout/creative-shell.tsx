import type { ReactNode } from "react";
import { AgentContextProvider } from "@/features/agent/agent-context";

/**
 * Focused full-screen chrome for a single creative — no app header or agent sidebar.
 * Mirrors the settings route-group pattern (separate shell, same auth).
 */
export function CreativeShell({ children }: { children: ReactNode }) {
  return (
    <AgentContextProvider>
      <div className="flex h-svh w-full overflow-hidden bg-canvas">
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </AgentContextProvider>
  );
}
