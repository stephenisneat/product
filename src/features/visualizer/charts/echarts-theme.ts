import type { EChartsOption } from "echarts";

/** Hex colors — ECharts canvas emphasis/blur can't lift oklch() and lines vanish on hover. */
export const chartColors = [
  "#a8bdd4",
  "#7eb89a",
  "#d4b87a",
  "#c4897a",
  "#a899c4",
];

export function baseChartOption(): EChartsOption {
  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: "#b3b3b3",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    },
    grid: {
      left: 48,
      right: 24,
      top: 48,
      bottom: 40,
      containLabel: false,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#242424",
      borderColor: "rgba(255,255,255,0.12)",
      textStyle: { color: "#ebebeb", fontSize: 12 },
    },
    legend: {
      top: 8,
      textStyle: { color: "#b8b8b8", fontSize: 12 },
    },
  };
}

/** Shared line-series styles that stay visible under axis-tooltip hover. */
export function lineSeriesPaint(color: string, opts?: { width?: number; area?: boolean }) {
  const width = opts?.width ?? 2;
  return {
    showSymbol: false,
    symbol: "circle",
    symbolSize: 7,
    lineStyle: { width, color, opacity: 1 },
    itemStyle: { color },
    ...(opts?.area
      ? { areaStyle: { opacity: 0.12, color } }
      : {}),
    emphasis: {
      focus: "none" as const,
      scale: false,
      lineStyle: { width, color, opacity: 1 },
      itemStyle: { color },
      ...(opts?.area ? { areaStyle: { opacity: 0.12, color } } : {}),
    },
    blur: {
      lineStyle: { width, color, opacity: 1 },
      itemStyle: { color, opacity: 1 },
      ...(opts?.area ? { areaStyle: { opacity: 0.12, color } } : {}),
    },
  };
}
