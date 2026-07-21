"use client";

import type { TimeseriesData } from "@/domain";
import {
  baseChartOption,
  chartColors,
  lineSeriesPaint,
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
        color: "#a6a6a6",
        fontSize: 11,
        formatter: (v: string) => (v.length > 7 ? v.slice(5) : v),
      },
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
      type: "line",
      smooth: true,
      data: s.points.map((p) => p.value),
      ...lineSeriesPaint(chartColors[i % chartColors.length]!, {
        width: 2,
        area: true,
      }),
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
