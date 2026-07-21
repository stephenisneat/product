"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BarData,
  ComparisonData,
  SankeyData,
  TimeseriesData,
  Visualization,
  VisualizationKind,
} from "@/domain";
import { BarChart } from "@/features/visualizer/charts/bar-chart";
import { ComparisonChart } from "@/features/visualizer/charts/comparison-chart";
import { SankeyChart } from "@/features/visualizer/charts/sankey-chart";
import { TimeseriesChart } from "@/features/visualizer/charts/timeseries-chart";
import { defaultExploreConfig } from "@/features/visualizer/explore/defaults";
import { flattenVisualization } from "@/features/visualizer/explore/flatten";
import {
  rebuildChartData,
  transformRows,
} from "@/features/visualizer/explore/transform";
import type { VizExploreConfig } from "@/features/visualizer/explore/types";
import { VisualizationToolbar } from "@/features/visualizer/visualization-toolbar";
import {
  getVisualization,
  openVisualizationTab,
} from "@/features/visualizer/visualization-store";

function ChartForKind({
  kind,
  data,
}: {
  kind: VisualizationKind;
  data: SankeyData | TimeseriesData | ComparisonData | BarData;
}) {
  switch (kind) {
    case "sankey":
      return <SankeyChart data={data as SankeyData} />;
    case "timeseries":
      return <TimeseriesChart data={data as TimeseriesData} />;
    case "comparison":
      return <ComparisonChart data={data as ComparisonData} />;
    case "bar":
      return <BarChart data={data as BarData} />;
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
  const [config, setConfig] = useState<VizExploreConfig | null>(null);

  useEffect(() => {
    const found = getVisualization(workspaceId, visualizationId);
    if (found) {
      openVisualizationTab(workspaceId, found.id);
      window.dispatchEvent(new Event("visualizations-changed"));
    }
    // Sync canvas when navigating between visualization ids.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate-from-storage
    setViz(found);
    setConfig(found ? defaultExploreConfig(found) : null);
  }, [workspaceId, visualizationId]);

  const dataset = useMemo(
    () => (viz ? flattenVisualization(viz) : null),
    [viz],
  );

  const defaults = useMemo(
    () => (viz && dataset ? defaultExploreConfig(viz, dataset) : null),
    [viz, dataset],
  );

  const filteredRowCount = useMemo(() => {
    if (!dataset || !config) return 0;
    return transformRows(dataset.rows, config).length;
  }, [dataset, config]);

  const chartData = useMemo(() => {
    if (!dataset || !config) return null;
    return rebuildChartData(dataset.rows, config);
  }, [dataset, config]);

  if (!viz || !dataset || !config || !defaults || !chartData) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Visualization not found. It may have been removed from this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <VisualizationToolbar
        dataset={dataset}
        config={config}
        defaults={defaults}
        filteredRowCount={filteredRowCount}
        onChange={setConfig}
        onReset={() => setConfig(defaultExploreConfig(viz, dataset))}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChartForKind kind={config.chartKind} data={chartData} />
      </div>
    </div>
  );
}
