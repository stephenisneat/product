import type { ReactNode } from "react";
import { SettingsShell } from "@/components/layout/settings-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return children;
  }

  return <SettingsShell user={user}>{children}</SettingsShell>;
}
