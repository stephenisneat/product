import { describe, expect, it } from "vitest";
import { createVisualization } from "@/features/visualizer/dummy-data";
import { defaultExploreConfig } from "@/features/visualizer/explore/defaults";
import { flattenVisualization } from "@/features/visualizer/explore/flatten";
import {
  applyFilters,
  rebuildChartData,
  transformRows,
} from "@/features/visualizer/explore/transform";
import type { VizExploreConfig } from "@/features/visualizer/explore/types";

describe("visualization explore flatten", () => {
  it("exposes every metric coming through a timeseries feed", () => {
    const viz = createVisualization({
      title: "Campaign performance",
      kind: "timeseries",
    });
    const dataset = flattenVisualization(viz);
    const keys = dataset.fields.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "date",
        "series",
        "value",
        "revenue",
        "spend",
        "conversions",
        "clicks",
        "impressions",
      ]),
    );
    expect(dataset.rows.length).toBeGreaterThan(0);
    expect(dataset.rows[0]).toMatchObject({
      series: expect.any(String),
      revenue: expect.any(Number),
      spend: expect.any(Number),
    });
  });

  it("flattens bar series into filterable long-form rows", () => {
    const viz = createVisualization({
      title: "Channel mix",
      kind: "bar",
    });
    const dataset = flattenVisualization(viz);
    expect(dataset.fields.map((f) => f.key)).toEqual(
      expect.arrayContaining([
        "category",
        "Spend",
        "Revenue",
        "Conversions",
        "Clicks",
      ]),
    );
    expect(dataset.rows).toHaveLength(5);
    expect(dataset.rows[0]).toMatchObject({
      category: "Meta",
      Spend: 12400,
      Revenue: 31200,
    });
  });

  it("flattens sankey links into source/target/value rows", () => {
    const viz = createVisualization({
      title: "Funnel",
      kind: "sankey",
    });
    const dataset = flattenVisualization(viz);
    expect(dataset.fields.map((f) => f.key)).toEqual([
      "source",
      "target",
      "value",
    ]);
    expect(dataset.rows[0]).toMatchObject({
      source: expect.any(String),
      target: expect.any(String),
      value: expect.any(Number),
    });
  });
});

describe("visualization explore transform", () => {
  it("filters and sorts rows before rebuild", () => {
    const viz = createVisualization({
      title: "Campaign performance",
      kind: "timeseries",
    });
    const dataset = flattenVisualization(viz);
    const filtered = applyFilters(dataset.rows, [
      {
        id: "1",
        field: "series",
        op: "eq",
        value: "Meta",
      },
    ]);
    expect(filtered.every((r) => r.series === "Meta")).toBe(true);

    const sorted = transformRows(dataset.rows, {
      ...defaultExploreConfig(viz, dataset),
      filters: [
        { id: "1", field: "series", op: "eq", value: "Meta" },
      ],
      sort: { field: "revenue", direction: "desc" },
    });
    for (let i = 1; i < sorted.length; i++) {
      expect(Number(sorted[i - 1]!.revenue)).toBeGreaterThanOrEqual(
        Number(sorted[i]!.revenue),
      );
    }
  });

  it("rebuilds a comparison chart from compared metrics", () => {
    const viz = createVisualization({
      title: "Campaign performance",
      kind: "timeseries",
    });
    const dataset = flattenVisualization(viz);
    const config: VizExploreConfig = {
      chartKind: "comparison",
      xField: "date",
      yField: "revenue",
      compareFields: ["spend"],
      seriesField: null,
      aggregate: "sum",
      filters: [
        { id: "1", field: "series", op: "eq", value: "Meta" },
      ],
      sort: { field: "date", direction: "asc" },
    };
    const data = rebuildChartData(dataset.rows, config);
    expect("series" in data).toBe(true);
    if (!("series" in data)) return;
    expect(data.series.map((s) => s.name)).toEqual(["revenue", "spend"]);
    const first = data.series[0]!;
    expect("points" in first).toBe(true);
    if (!("points" in first)) return;
    expect(first.points.length).toBeGreaterThan(0);
  });

  it("can remake a bar chart as a timeseries encoding", () => {
    const viz = createVisualization({
      title: "Channel mix",
      kind: "bar",
    });
    const dataset = flattenVisualization(viz);
    const config: VizExploreConfig = {
      chartKind: "bar",
      xField: "category",
      yField: "Spend",
      compareFields: ["Revenue"],
      seriesField: null,
      aggregate: "sum",
      filters: [],
      sort: null,
    };
    const data = rebuildChartData(dataset.rows, config);
    expect("categories" in data).toBe(true);
    if (!("categories" in data)) return;
    expect(data.categories).toContain("Meta");
    expect(data.series.map((s) => s.name)).toEqual(["Spend", "Revenue"]);
  });
});
