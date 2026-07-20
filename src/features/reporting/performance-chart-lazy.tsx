"use client";

import dynamic from "next/dynamic";
import type { PerformancePoint } from "@/domain";

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

export function PerformanceChartLazy({ data }: { data: PerformancePoint[] }) {
  return <Chart data={data} />;
}
