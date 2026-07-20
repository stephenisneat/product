import type { ReactNode } from "react";
import { CreativeShell } from "@/components/layout/creative-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function CreativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return children;
  }

  return <CreativeShell>{children}</CreativeShell>;
}
