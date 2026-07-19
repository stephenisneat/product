"use client";

import type { TimeseriesData } from "@/domain";
import {
  baseChartOption,
  chartColors,
} from "@/features/visualizer/charts/echarts-theme";
import { ReactECharts } from "@/features/visualizer/charts/react-echarts";

export function TimeseriesChart({ data }: { data: TimeseriesData }) {
  const categories = data.series[0]?.points.map((p) => p.date) ?? [];

  const option = {
    ...baseChartOption(),
    xAxis: {
      type: "category",
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "oklch(0.65 0 0)",
        fontSize: 11,
        formatter: (v: string) => (v.length > 7 ? v.slice(5) : v),
      },
    },
    yAxis: {
      type: "value",
      name: data.metric,
      nameTextStyle: { color: "oklch(0.65 0 0)", fontSize: 11 },
      splitLine: { lineStyle: { color: "oklch(1 0 0 / 8%)" } },
      axisLabel: { color: "oklch(0.65 0 0)", fontSize: 11 },
    },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: "line",
      smooth: true,
      showSymbol: false,
      data: s.points.map((p) => p.value),
      lineStyle: { width: 2, color: chartColors[i % chartColors.length] },
      itemStyle: { color: chartColors[i % chartColors.length] },
      areaStyle: { opacity: 0.12, color: chartColors[i % chartColors.length] },
    })),
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
