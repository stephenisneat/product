import type {
  BarData,
  ComparisonData,
  SankeyData,
  TimeseriesData,
  Visualization,
  VisualizationKind,
} from "@/domain";
import type { VizDataset, VizField, VizRow } from "@/features/visualizer/explore/types";

function field(
  key: string,
  label: string,
  type: VizField["type"],
): VizField {
  return { key, label, type };
}

function flattenSankey(data: SankeyData): VizDataset {
  const rows: VizRow[] = data.links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.value,
  }));
  return {
    fields: [
      field("source", "Source", "category"),
      field("target", "Target", "category"),
      field("value", "Value", "number"),
    ],
    rows,
    metricLabel: "Flow",
  };
}

function flattenTimeseriesLike(
  data: TimeseriesData | ComparisonData,
  options?: { includeMetricAsField?: boolean },
): VizDataset {
  const rows: VizRow[] = [];
  const metricKeys = new Set<string>();

  for (const series of data.series) {
    for (const point of series.points) {
      const row: VizRow = {
        date: point.date,
        series: series.name,
        value: point.value,
        metric: data.metric,
      };
      // Wide metrics: if point carries extra numeric keys, surface them.
      for (const [key, val] of Object.entries(point)) {
        if (key === "date" || key === "value") continue;
        if (typeof val === "number") {
          row[key] = val;
          metricKeys.add(key);
        }
      }
      rows.push(row);
    }
  }

  const fields: VizField[] = [
    field("date", "Date", "date"),
    field("series", "Series", "category"),
    field("value", data.metric || "Value", "number"),
  ];
  if (options?.includeMetricAsField !== false) {
    fields.push(field("metric", "Metric", "category"));
  }
  for (const key of metricKeys) {
    fields.push(field(key, labelize(key), "number"));
  }

  return { fields, rows, metricLabel: data.metric };
}

function flattenBar(data: BarData): VizDataset {
  const seriesFields = data.series.map((s) =>
    field(s.name, s.name, "number"),
  );

  const rows: VizRow[] = data.categories.map((category, i) => {
    const row: VizRow = {
      category,
      metric: data.metric,
    };
    for (const series of data.series) {
      row[series.name] = series.values[i] ?? null;
    }
    return row;
  });

  return {
    fields: [
      field("category", "Category", "category"),
      field("metric", "Metric", "category"),
      ...seriesFields,
    ],
    rows,
    metricLabel: data.metric,
  };
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function flattenVisualization(viz: Visualization): VizDataset {
  switch (viz.kind) {
    case "sankey":
      return flattenSankey(viz.data as SankeyData);
    case "timeseries":
      return flattenTimeseriesLike(viz.data as TimeseriesData);
    case "comparison":
      return flattenTimeseriesLike(viz.data as ComparisonData);
    case "bar":
      return flattenBar(viz.data as BarData);
  }
}

export function uniqueValues(
  rows: VizRow[],
  fieldKey: string,
  limit = 50,
): Array<string | number> {
  const seen = new Set<string>();
  const out: Array<string | number> = [];
  for (const row of rows) {
    const v = row[fieldKey];
    if (v == null) continue;
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

export function fieldsForKind(
  kind: VisualizationKind,
  dataset: VizDataset,
): {
  categoryFields: VizField[];
  numberFields: VizField[];
  dateFields: VizField[];
} {
  const categoryFields = dataset.fields.filter(
    (f) => f.type === "category" || f.type === "string" || f.type === "date",
  );
  const numberFields = dataset.fields.filter((f) => f.type === "number");
  const dateFields = dataset.fields.filter((f) => f.type === "date");

  // Prefer sensible defaults based on kind, but expose everything.
  void kind;
  return { categoryFields, numberFields, dateFields };
}
