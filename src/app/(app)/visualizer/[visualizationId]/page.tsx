import { redirect } from "next/navigation";
import { VisualizationCanvas } from "@/features/visualizer/visualization-canvas";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function VisualizationPage({
  params,
}: {
  params: Promise<{ visualizationId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/visualizer");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const { visualizationId } = await params;

  return (
    <VisualizationCanvas
      key={`${active.workspace.id}:${visualizationId}`}
      workspaceId={active.workspace.id}
      visualizationId={visualizationId}
    />
  );
}
