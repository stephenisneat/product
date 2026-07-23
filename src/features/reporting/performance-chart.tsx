"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformancePoint } from "@/domain";
import { formatMoney } from "@/lib/format";

export type PerformanceMetricKey =
  | "spend"
  | "revenue"
  | "impressions"
  | "clicks"
  | "conversions"
  | "roas";

export const PERFORMANCE_METRICS: {
  key: PerformanceMetricKey;
  label: string;
  format: "money" | "number" | "ratio";
}[] = [
  { key: "spend", label: "Spend", format: "money" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "conversions", label: "Conversions", format: "number" },
  { key: "clicks", label: "Clicks", format: "number" },
  { key: "impressions", label: "Impressions", format: "number" },
];

export function formatPerformanceMetric(
  key: PerformanceMetricKey,
  value: number,
): string {
  if (key === "spend" || key === "revenue") return formatMoney(value);
  if (key === "roas") {
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(2)}x`;
  }
  return Math.round(value).toLocaleString();
}

export function withDerivedMetrics(
  points: PerformancePoint[],
): Array<PerformancePoint & { roas: number }> {
  return points.map((p) => ({
    ...p,
    roas: p.spend > 0 ? p.revenue / p.spend : 0,
  }));
}

export function PerformanceChart({
  data,
  metric = "revenue",
}: {
  data: PerformancePoint[];
  metric?: PerformanceMetricKey;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No performance data yet
      </div>
    );
  }

  const chartData = withDerivedMetrics(data);
  const meta =
    PERFORMANCE_METRICS.find((m) => m.key === metric) ?? PERFORMANCE_METRICS[0];
  const gradientId = `perf-${metric}`;

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0 0)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="oklch(0.78 0 0)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fill: "oklch(0.7 0 0)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "oklch(0.7 0 0)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => {
              if (meta.format === "money") {
                if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`;
                return `$${Math.round(v)}`;
              }
              if (meta.format === "ratio") return `${Number(v).toFixed(1)}x`;
              if (Math.abs(v) >= 1_000_000)
                return `${(v / 1_000_000).toFixed(1)}M`;
              if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
              return String(Math.round(v));
            }}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.18 0 0)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [formatPerformanceMetric(metric, n), meta.label];
            }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            name={meta.label}
            stroke="oklch(0.86 0 0)"
            fill={`url(#${gradientId})`}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
