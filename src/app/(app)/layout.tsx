import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return children;
  }

  const active = await getActiveWorkspace();

  return (
    <AppShell
      user={user}
      workspaces={active?.workspaces ?? []}
      activeWorkspaceId={active?.workspace.id ?? null}
      activeRole={active?.role ?? null}
    >
      {children}
    </AppShell>
  );
}
