import type { PerformancePoint } from "@/domain";

/** Placeholder analytics until live ingestion exists. */
export function buildPerformanceSeries(productId: string): PerformancePoint[] {
  const base =
    productId === "prod_aurora_bottle"
      ? 1.4
      : productId === "prod_trail_pack"
        ? 1.1
        : productId === "prod_linen_throw"
          ? 0.9
          : 0.6;

  const days = [
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11",
    "2026-07-12",
    "2026-07-13",
    "2026-07-14",
  ];

  return days.map((date, index) => {
    const wave = 1 + Math.sin(index / 2.2) * 0.25;
    const impressions = Math.round(4200 * base * wave);
    const clicks = Math.round(impressions * 0.028);
    const spend = Number((clicks * 1.15 * base).toFixed(2));
    const conversions = Math.round(clicks * 0.09);
    const revenue = Number((conversions * (48 * base)).toFixed(2));
    return { date, impressions, clicks, spend, conversions, revenue };
  });
}
