import { describe, expect, it } from "vitest";
import {
  BACKFILL_SYNC_DAYS,
  INCREMENTAL_SYNC_DAYS,
  syncDateRange,
} from "@/lib/performance/date-range";
import {
  barFromPerformance,
  emptyTimeseriesData,
  timeseriesFromPerformance,
} from "@/lib/performance/build-visualization-data";
import type { PerformanceQueryResult } from "@/repositories/performance";

describe("syncDateRange", () => {
  it("uses backfill window when never synced", () => {
    const range = syncDateRange({ lastSyncedAt: null });
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const start = new Date(`${range.startDate}T00:00:00Z`);
    const end = new Date(`${range.endDate}T00:00:00Z`);
    const days =
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(BACKFILL_SYNC_DAYS);
  });

  it("uses incremental window after a prior sync", () => {
    const range = syncDateRange({
      lastSyncedAt: "2026-07-20T06:00:00.000Z",
    });
    const start = new Date(`${range.startDate}T00:00:00Z`);
    const end = new Date(`${range.endDate}T00:00:00Z`);
    const days =
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INCREMENTAL_SYNC_DAYS);
  });
});

describe("visualization from performance", () => {
  const sample: PerformanceQueryResult = {
    series: [
      {
        date: "2026-07-01",
        impressions: 1000,
        clicks: 50,
        spend: 20,
        conversions: 3,
        revenue: 90,
      },
    ],
    breakdown: [
      {
        key: "google",
        label: "google",
        impressions: 1000,
        clicks: 50,
        spend: 20,
        conversions: 3,
        revenue: 90,
      },
    ],
    totals: {
      impressions: 1000,
      clicks: 50,
      spend: 20,
      conversions: 3,
      revenue: 90,
    },
    campaignCount: 1,
  };

  it("builds timeseries points from series", () => {
    const data = timeseriesFromPerformance(sample);
    expect(data.series[0]?.points).toHaveLength(1);
    expect(data.series[0]?.points[0]?.value).toBe(90);
  });

  it("builds bar categories from breakdown", () => {
    const data = barFromPerformance(sample);
    expect(data.categories).toEqual(["google"]);
    expect(data.series.find((s) => s.name === "Spend")?.values[0]).toBe(20);
  });

  it("returns empty timeseries when no data", () => {
    expect(emptyTimeseriesData().series[0]?.points).toEqual([]);
  });
});
