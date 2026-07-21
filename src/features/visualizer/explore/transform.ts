import type {
  BarData,
  ComparisonData,
  SankeyData,
  TimeseriesData,
} from "@/domain";
import { applyDateRange } from "@/features/visualizer/explore/date-range";
import type {
  VizAggregate,
  VizCell,
  VizExploreConfig,
  VizFilter,
  VizRow,
  VizSort,
} from "@/features/visualizer/explore/types";

function asNumber(value: VizCell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: VizCell): string {
  if (value == null) return "";
  return String(value);
}

export function matchesFilter(row: VizRow, filter: VizFilter): boolean {
  const cell = row[filter.field];
  const raw = filter.value.trim();
  if (!filter.field) return true;

  switch (filter.op) {
    case "eq":
      return asString(cell).toLowerCase() === raw.toLowerCase();
    case "neq":
      return asString(cell).toLowerCase() !== raw.toLowerCase();
    case "contains":
      return asString(cell).toLowerCase().includes(raw.toLowerCase());
    case "in": {
      const parts = raw
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      if (parts.length === 0) return true;
      return parts.includes(asString(cell).toLowerCase());
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = asNumber(cell);
      const right = asNumber(raw);
      if (left == null || right == null) return false;
      if (filter.op === "gt") return left > right;
      if (filter.op === "gte") return left >= right;
      if (filter.op === "lt") return left < right;
      return left <= right;
    }
  }
}

export function applyFilters(rows: VizRow[], filters: VizFilter[]): VizRow[] {
  const active = filters.filter((f) => f.field && f.value.trim() !== "");
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => matchesFilter(row, f)));
}

export function applySort(rows: VizRow[], sort: VizSort | null): VizRow[] {
  if (!sort?.field) return rows;
  const dir = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sort.field];
    const bv = b[sort.field];
    const an = asNumber(av);
    const bn = asNumber(bv);
    if (an != null && bn != null) return (an - bn) * dir;
    return asString(av).localeCompare(asString(bv)) * dir;
  });
}

function aggregateValues(values: number[], aggregate: VizAggregate): number {
  if (values.length === 0) return 0;
  switch (aggregate) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "count":
      return values.length;
  }
}

function metricLabel(config: VizExploreConfig, fallback = "Value"): string {
  const parts = [config.yField, ...config.compareFields].filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!;
  return parts.join(" vs ");
}

function buildSankey(rows: VizRow[], config: VizExploreConfig): SankeyData {
  const sourceKey = config.xField || "source";
  const targetKey = config.seriesField || "target";
  const valueKey = config.yField || "value";
  const nodeNames = new Set<string>();
  const linkMap = new Map<string, number[]>();

  for (const row of rows) {
    const source = asString(row[sourceKey]);
    const target = asString(row[targetKey]);
    const value = asNumber(row[valueKey]);
    if (!source || !target || value == null) continue;
    nodeNames.add(source);
    nodeNames.add(target);
    const key = `${source}\0${target}`;
    const bucket = linkMap.get(key) ?? [];
    bucket.push(value);
    linkMap.set(key, bucket);
  }

  return {
    nodes: [...nodeNames].map((name) => ({ name })),
    links: [...linkMap.entries()].map(([key, values]) => {
      const [source, target] = key.split("\0") as [string, string];
      return {
        source,
        target,
        value: Math.round(aggregateValues(values, config.aggregate) * 100) / 100,
      };
    }),
  };
}

function buildTimeseries(
  rows: VizRow[],
  config: VizExploreConfig,
): TimeseriesData {
  const xKey = config.xField || "date";
  const yKeys = [config.yField, ...config.compareFields].filter(Boolean);
  const seriesKey = config.seriesField;

  const categories: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const x = asString(row[xKey]);
    if (!x || seen.has(x)) continue;
    seen.add(x);
    categories.push(x);
  }

  // Comparing multiple numeric fields → each field is a series.
  if (yKeys.length > 1 || !seriesKey) {
    const series = yKeys.map((yKey) => {
      const byX = new Map<string, number[]>();
      for (const row of rows) {
        const x = asString(row[xKey]);
        const y = asNumber(row[yKey]);
        if (!x || y == null) continue;
        const bucket = byX.get(x) ?? [];
        bucket.push(y);
        byX.set(x, bucket);
      }
      return {
        name: yKey,
        points: categories.map((date) => ({
          date,
          value:
            Math.round(
              aggregateValues(byX.get(date) ?? [], config.aggregate) * 100,
            ) / 100,
        })),
      };
    });

    return {
      metric: metricLabel(config),
      series:
        series.length > 0
          ? series
          : [{ name: config.yField || "value", points: [] }],
    };
  }

  const yKey = config.yField || "value";
  const groups = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const x = asString(row[xKey]);
    const s = asString(row[seriesKey]) || "Series";
    const y = asNumber(row[yKey]);
    if (!x || y == null) continue;
    let byX = groups.get(s);
    if (!byX) {
      byX = new Map();
      groups.set(s, byX);
    }
    const bucket = byX.get(x) ?? [];
    bucket.push(y);
    byX.set(x, bucket);
  }

  return {
    metric: yKey,
    series: [...groups.entries()].map(([name, byX]) => ({
      name,
      points: categories.map((date) => ({
        date,
        value:
          Math.round(
            aggregateValues(byX.get(date) ?? [], config.aggregate) * 100,
          ) / 100,
      })),
    })),
  };
}

function buildComparison(
  rows: VizRow[],
  config: VizExploreConfig,
): ComparisonData {
  return buildTimeseries(rows, config);
}

function buildBar(rows: VizRow[], config: VizExploreConfig): BarData {
  const xKey = config.xField || "category";
  const yKeys = [config.yField, ...config.compareFields].filter(Boolean);
  const seriesKey = config.seriesField;

  const categories: string[] = [];
  const catSeen = new Set<string>();
  for (const row of rows) {
    const x = asString(row[xKey]);
    if (!x || catSeen.has(x)) continue;
    catSeen.add(x);
    categories.push(x);
  }

  if (seriesKey && yKeys.length <= 1) {
    const yKey = yKeys[0] || "value";
    const seriesNames: string[] = [];
    const seriesSeen = new Set<string>();
    for (const row of rows) {
      const s = asString(row[seriesKey]) || "Series";
      if (seriesSeen.has(s)) continue;
      seriesSeen.add(s);
      seriesNames.push(s);
    }

    return {
      metric: yKey,
      categories,
      series: seriesNames.map((name) => ({
        name,
        values: categories.map((cat) => {
          const values: number[] = [];
          for (const row of rows) {
            if (asString(row[xKey]) !== cat) continue;
            if (asString(row[seriesKey]) !== name) continue;
            const n = asNumber(row[yKey]);
            if (n != null) values.push(n);
          }
          return (
            Math.round(aggregateValues(values, config.aggregate) * 100) / 100
          );
        }),
      })),
    };
  }

  return {
    metric: metricLabel(config),
    categories,
    series: yKeys.map((yKey) => ({
      name: yKey,
      values: categories.map((cat) => {
        const values: number[] = [];
        for (const row of rows) {
          if (asString(row[xKey]) !== cat) continue;
          const n = asNumber(row[yKey]);
          if (n != null) values.push(n);
        }
        return (
          Math.round(aggregateValues(values, config.aggregate) * 100) / 100
        );
      }),
    })),
  };
}

export function transformRows(
  rows: VizRow[],
  config: VizExploreConfig,
): VizRow[] {
  return applySort(
    applyDateRange(applyFilters(rows, config.filters), config.dateRange),
    config.sort,
  );
}

export function rebuildChartData(
  rows: VizRow[],
  config: VizExploreConfig,
): SankeyData | TimeseriesData | ComparisonData | BarData {
  if (config.chartKind === "table") {
    throw new Error("Cannot rebuild chart data for table view");
  }
  const prepared = transformRows(rows, config);
  switch (config.chartKind) {
    case "sankey":
      return buildSankey(prepared, config);
    case "timeseries":
      return buildTimeseries(prepared, config);
    case "comparison":
      return buildComparison(prepared, config);
    case "bar":
      return buildBar(prepared, config);
  }
}

export function newFilterId(): string {
  return `flt_${Math.random().toString(36).slice(2, 9)}`;
}
