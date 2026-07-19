"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CatalogNav } from "@/features/products/catalog-toolbar";
import { VisualizationTabs } from "@/features/visualizer/visualization-tabs";
import { setLastVisualizerPath } from "@/features/visualizer/visualization-store";

export function VisualizerShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/visualizer")) return;
    const path =
      pathname === "/visualizer" || pathname === "/visualizer/"
        ? "/visualizer"
        : pathname;
    setLastVisualizerPath(workspaceId, path);
    window.dispatchEvent(new Event("visualizations-changed"));
  }, [pathname, workspaceId]);

  return (
    <PageCanvas
      header={<CatalogNav workspaceId={workspaceId} />}
      contentClassName="flex flex-col overflow-hidden"
    >
      <VisualizationTabs workspaceId={workspaceId} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </PageCanvas>
  );
}
