"use client";

import dynamic from "next/dynamic";
import type { PerformancePoint } from "@/domain";
import type { PerformanceMetricKey } from "@/features/reporting/performance-chart";

const Chart = dynamic(
  () =>
    import("@/features/reporting/performance-chart").then(
      (m) => m.PerformanceChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Loading chart…
      </div>
    ),
  },
);

export function PerformanceChartLazy({
  data,
  metric,
}: {
  data: PerformancePoint[];
  metric?: PerformanceMetricKey;
}) {
  return <Chart data={data} metric={metric} />;
}
