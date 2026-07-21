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
      backgroundColor: "#242424",
      borderColor: "rgba(255,255,255,0.12)",
      textStyle: { color: "#ebebeb", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: data.categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#a6a6a6", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: data.metric,
      nameTextStyle: { color: "#a6a6a6", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: "#a6a6a6", fontSize: 11 },
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
      emphasis: {
        focus: "none" as const,
        itemStyle: {
          color: chartColors[i % chartColors.length],
        },
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
