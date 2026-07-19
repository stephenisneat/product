"use client";

import dynamic from "next/dynamic";

export const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
      Loading chart…
    </div>
  ),
});
