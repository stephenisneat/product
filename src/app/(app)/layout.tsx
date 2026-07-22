import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return children;
  }

  const [active, platformAdmin] = await Promise.all([
    getActiveWorkspace(),
    isPlatformAdmin(user.id),
  ]);

  return (
    <AppShell
      user={user}
      workspaces={active?.workspaces ?? []}
      activeWorkspaceId={active?.workspace.id ?? null}
      activeRole={active?.role ?? null}
      isPlatformAdmin={platformAdmin}
    >
      {children}
    </AppShell>
  );
}
