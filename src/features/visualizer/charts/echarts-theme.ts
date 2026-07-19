import type { EChartsOption } from "echarts";

export const chartColors = [
  "oklch(0.78 0.05 250)",
  "oklch(0.72 0.08 160)",
  "oklch(0.75 0.07 80)",
  "oklch(0.7 0.06 20)",
  "oklch(0.68 0.04 300)",
];

export function baseChartOption(): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: {
      color: "oklch(0.75 0 0)",
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
      backgroundColor: "oklch(0.18 0 0)",
      borderColor: "oklch(1 0 0 / 12%)",
      textStyle: { color: "oklch(0.92 0 0)", fontSize: 12 },
    },
    legend: {
      top: 8,
      textStyle: { color: "oklch(0.72 0 0)", fontSize: 12 },
    },
  };
}
