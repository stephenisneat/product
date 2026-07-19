"use client";

import { useEffect, useState } from "react";
import type {
  BarData,
  ComparisonData,
  SankeyData,
  TimeseriesData,
  Visualization,
} from "@/domain";
import { BarChart } from "@/features/visualizer/charts/bar-chart";
import { ComparisonChart } from "@/features/visualizer/charts/comparison-chart";
import { SankeyChart } from "@/features/visualizer/charts/sankey-chart";
import { TimeseriesChart } from "@/features/visualizer/charts/timeseries-chart";
import {
  getVisualization,
  openVisualizationTab,
} from "@/features/visualizer/visualization-store";

function ChartForVisualization({ viz }: { viz: Visualization }) {
  switch (viz.kind) {
    case "sankey":
      return <SankeyChart data={viz.data as SankeyData} />;
    case "timeseries":
      return <TimeseriesChart data={viz.data as TimeseriesData} />;
    case "comparison":
      return <ComparisonChart data={viz.data as ComparisonData} />;
    case "bar":
      return <BarChart data={viz.data as BarData} />;
  }
}

export function VisualizationCanvas({
  workspaceId,
  visualizationId,
}: {
  workspaceId: string;
  visualizationId: string;
}) {
  // SSR-safe default; localStorage is read after mount to avoid hydration mismatch.
  const [viz, setViz] = useState<Visualization | null>(null);

  useEffect(() => {
    const found = getVisualization(workspaceId, visualizationId);
    if (found) {
      openVisualizationTab(workspaceId, found.id);
      window.dispatchEvent(new Event("visualizations-changed"));
    }
    // Sync canvas when navigating between visualization ids.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate-from-storage
    setViz(found);
  }, [workspaceId, visualizationId]);

  if (!viz) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Visualization not found. It may have been removed from this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-4">
      <div className="mb-3 shrink-0">
        <h1 className="text-base font-medium tracking-tight">{viz.title}</h1>
        {viz.prompt ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{viz.prompt}</p>
        ) : null}
      </div>
      <div className="min-h-[420px] flex-1 rounded-lg border border-border bg-background/30 p-2">
        <ChartForVisualization viz={viz} />
      </div>
    </div>
  );
}
