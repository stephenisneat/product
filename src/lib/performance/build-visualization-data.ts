import type {
  BarData,
  ComparisonData,
  PerformancePoint,
  SankeyData,
  TimeseriesData,
  Visualization,
  VisualizationKind,
} from "@/domain";
import type { PerformanceQueryResult } from "@/repositories/performance";

function newVizId() {
  return `viz_${crypto.randomUUID().slice(0, 10)}`;
}

function pointExtras(p: PerformancePoint) {
  return {
    date: p.date,
    value: p.revenue,
    revenue: p.revenue,
    spend: p.spend,
    conversions: p.conversions,
    clicks: p.clicks,
    impressions: p.impressions,
  };
}

export function emptyTimeseriesData(metric = "Revenue"): TimeseriesData {
  return {
    metric,
    series: [{ name: "All campaigns", points: [] }],
  };
}

export function emptyBarData(metric = "Spend"): BarData {
  return {
    metric,
    categories: [],
    series: [
      { name: "Spend", values: [] },
      { name: "Revenue", values: [] },
      { name: "Conversions", values: [] },
      { name: "Clicks", values: [] },
    ],
  };
}

export function emptyComparisonData(metric = "Revenue"): ComparisonData {
  return {
    metric,
    series: [
      { name: "Period A", points: [] },
      { name: "Period B", points: [] },
    ],
  };
}

/** Structural placeholder until funnel events exist. */
export function emptySankeyData(): SankeyData {
  return {
    nodes: [
      { name: "Impressions" },
      { name: "Clicks" },
      { name: "Conversions" },
      { name: "Revenue" },
    ],
    links: [],
  };
}

export function timeseriesFromPerformance(
  result: PerformanceQueryResult,
): TimeseriesData {
  if (result.series.length === 0) return emptyTimeseriesData();
  return {
    metric: "Revenue",
    series: [
      {
        name: "All campaigns",
        points: result.series.map(pointExtras),
      },
    ],
  };
}

export function barFromPerformance(result: PerformanceQueryResult): BarData {
  if (result.breakdown.length === 0) return emptyBarData();
  const categories = result.breakdown.map((row) => row.label);
  return {
    metric: "Spend",
    categories,
    series: [
      {
        name: "Spend",
        values: result.breakdown.map((row) => row.spend),
      },
      {
        name: "Revenue",
        values: result.breakdown.map((row) => row.revenue),
      },
      {
        name: "Conversions",
        values: result.breakdown.map((row) => row.conversions),
      },
      {
        name: "Clicks",
        values: result.breakdown.map((row) => row.clicks),
      },
    ],
  };
}

export function comparisonFromPerformance(
  periodA: PerformanceQueryResult,
  periodB: PerformanceQueryResult,
  labelA: string,
  labelB: string,
): ComparisonData {
  return {
    metric: "Revenue",
    series: [
      {
        name: labelA,
        points: periodA.series.map(pointExtras),
      },
      {
        name: labelB,
        points: periodB.series.map(pointExtras),
      },
    ],
  };
}

/** Derive a crude funnel from totals when no event-level funnel exists. */
export function sankeyFromPerformance(
  result: PerformanceQueryResult,
): SankeyData {
  const { impressions, clicks, conversions, revenue } = result.totals;
  if (impressions <= 0 && clicks <= 0) return emptySankeyData();
  return {
    nodes: [
      { name: "Impressions" },
      { name: "Clicks" },
      { name: "Conversions" },
      { name: "Revenue" },
    ],
    links: [
      {
        source: "Impressions",
        target: "Clicks",
        value: Math.max(clicks, 0),
      },
      {
        source: "Clicks",
        target: "Conversions",
        value: Math.max(conversions, 0),
      },
      {
        source: "Conversions",
        target: "Revenue",
        value: Math.max(revenue, 0),
      },
    ].filter((link) => link.value > 0),
  };
}

export function visualizationDataFromPerformance(
  kind: VisualizationKind,
  result: PerformanceQueryResult,
  options?: {
    periodAResult?: PerformanceQueryResult;
    periodBResult?: PerformanceQueryResult;
    periodA?: string;
    periodB?: string;
  },
): Visualization["data"] {
  switch (kind) {
    case "timeseries":
      return timeseriesFromPerformance(result);
    case "bar":
      return barFromPerformance(result);
    case "comparison":
      return comparisonFromPerformance(
        options?.periodAResult ?? result,
        options?.periodBResult ?? emptyResult(),
        options?.periodA ?? "Period A",
        options?.periodB ?? "Period B",
      );
    case "sankey":
      return sankeyFromPerformance(result);
  }
}

function emptyResult(): PerformanceQueryResult {
  return {
    series: [],
    breakdown: [],
    totals: {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      revenue: 0,
    },
    campaignCount: 0,
  };
}

export function emptyVisualizationData(
  kind: VisualizationKind,
): Visualization["data"] {
  switch (kind) {
    case "timeseries":
      return emptyTimeseriesData();
    case "bar":
      return emptyBarData();
    case "comparison":
      return emptyComparisonData();
    case "sankey":
      return emptySankeyData();
  }
}

export function createVisualizationRecord(input: {
  title: string;
  kind: VisualizationKind;
  data: Visualization["data"];
  prompt?: string;
  id?: string;
}): Visualization {
  const now = new Date().toISOString();
  return {
    id: input.id ?? newVizId(),
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    data: input.data,
    createdAt: now,
    updatedAt: now,
  };
}
