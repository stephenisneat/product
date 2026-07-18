"use client";

import type { BarData } from "@/domain";
import {
  baseChartOption,
  chartColors,
} from "@/features/visualizer/charts/echarts-theme";
import { ReactECharts } from "@/features/visualizer/charts/react-echarts";

export function BarChart({ data }: { data: BarData }) {
  const option = {
    ...baseChartOption(),
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "oklch(0.18 0 0)",
      borderColor: "oklch(1 0 0 / 12%)",
      textStyle: { color: "oklch(0.92 0 0)", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: data.categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "oklch(0.65 0 0)", fontSize: 11 },
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
      type: "bar",
      data: s.values,
      barMaxWidth: 36,
      itemStyle: {
        color: chartColors[i % chartColors.length],
        borderRadius: [4, 4, 0, 0],
      },
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
