import { redirect } from "next/navigation";
import { NewVisualizationScreen } from "@/features/visualizer/new-visualization-screen";
import { VisualizerShell } from "@/features/visualizer/visualizer-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function VisualizerPage() {
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
      <NewVisualizationScreen
        key={active.workspace.id}
        workspaceId={active.workspace.id}
      />
    </VisualizerShell>
  );
}
