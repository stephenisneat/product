"use client";

import type { SankeyData } from "@/domain";
import {
  baseChartOption,
  chartColors,
} from "@/features/visualizer/charts/echarts-theme";
import { ReactECharts } from "@/features/visualizer/charts/react-echarts";

export function SankeyChart({ data }: { data: SankeyData }) {
  const option = {
    ...baseChartOption(),
    tooltip: {
      trigger: "item",
      backgroundColor: "oklch(0.18 0 0)",
      borderColor: "oklch(1 0 0 / 12%)",
      textStyle: { color: "oklch(0.92 0 0)", fontSize: 12 },
    },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        data: data.nodes.map((n) => ({ name: n.name })),
        links: data.links.map((l) => ({
          source: l.source,
          target: l.target,
          value: l.value,
        })),
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
        itemStyle: { borderWidth: 0 },
        label: {
          color: "oklch(0.85 0 0)",
          fontSize: 12,
        },
        levels: chartColors.map((color, depth) => ({
          depth,
          itemStyle: { color },
        })),
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%", minHeight: 420 }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
