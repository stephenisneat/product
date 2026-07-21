import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { VisualizerShell } from "@/features/visualizer/visualizer-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function VisualizerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/visualizer");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return (
    <VisualizerShell workspaceId={active.workspace.id}>
      {children}
    </VisualizerShell>
  );
}
