import type { Visualization, VisualizationKind } from "@/domain";
import { flattenVisualization } from "@/features/visualizer/explore/flatten";
import type {
  VizDataset,
  VizExploreConfig,
  VizField,
} from "@/features/visualizer/explore/types";

function firstField(
  fields: VizField[],
  preferred: string[],
  type?: VizField["type"],
): string {
  for (const key of preferred) {
    if (fields.some((f) => f.key === key && (!type || f.type === type))) {
      return key;
    }
  }
  const typed = type ? fields.find((f) => f.type === type) : fields[0];
  return typed?.key ?? fields[0]?.key ?? "value";
}

function defaultCompareFields(
  kind: VisualizationKind,
  fields: VizField[],
  yField: string,
): string[] {
  const numbers = fields.filter((f) => f.type === "number" && f.key !== yField);
  if (kind === "bar") {
    // Prefer named series metrics (Spend, Revenue) over generic "value".
    const named = numbers.filter((f) => f.key !== "value").slice(0, 1);
    return named.map((f) => f.key);
  }
  if (kind === "comparison" || kind === "timeseries") {
    return [];
  }
  return [];
}

export function defaultExploreConfig(
  viz: Visualization,
  dataset?: VizDataset,
): VizExploreConfig {
  const data = dataset ?? flattenVisualization(viz);
  const { fields } = data;

  switch (viz.kind) {
    case "sankey":
      return {
        chartKind: "sankey",
        xField: firstField(fields, ["source"], "category"),
        yField: firstField(fields, ["value"], "number"),
        compareFields: [],
        seriesField: firstField(fields, ["target"], "category"),
        aggregate: "sum",
        filters: [],
        sort: { field: "value", direction: "desc" },
      };
    case "timeseries":
      return {
        chartKind: "timeseries",
        xField: firstField(fields, ["date"], "date"),
        yField: firstField(fields, ["value", "revenue"], "number"),
        compareFields: defaultCompareFields("timeseries", fields, "value"),
        seriesField: firstField(fields, ["series"], "category"),
        aggregate: "sum",
        filters: [],
        sort: { field: "date", direction: "asc" },
      };
    case "comparison":
      return {
        chartKind: "comparison",
        xField: firstField(fields, ["date"], "date"),
        yField: firstField(fields, ["value"], "number"),
        compareFields: [],
        seriesField: firstField(fields, ["series"], "category"),
        aggregate: "sum",
        filters: [],
        sort: { field: "date", direction: "asc" },
      };
    case "bar": {
      const spend = fields.find((f) => f.key === "Spend");
      const revenue = fields.find((f) => f.key === "Revenue");
      if (spend && revenue) {
        return {
          chartKind: "bar",
          xField: firstField(fields, ["category"], "category"),
          yField: spend.key,
          compareFields: [revenue.key],
          seriesField: null,
          aggregate: "sum",
          filters: [],
          sort: null,
        };
      }
      return {
        chartKind: "bar",
        xField: firstField(fields, ["category"], "category"),
        yField: firstField(fields, ["value"], "number"),
        compareFields: defaultCompareFields("bar", fields, "value"),
        seriesField: firstField(fields, ["series"], "category"),
        aggregate: "sum",
        filters: [],
        sort: null,
      };
    }
  }
}

export function exploreConfigIsActive(
  config: VizExploreConfig,
  defaults: VizExploreConfig,
): boolean {
  return (
    config.chartKind !== defaults.chartKind ||
    config.xField !== defaults.xField ||
    config.yField !== defaults.yField ||
    config.seriesField !== defaults.seriesField ||
    config.aggregate !== defaults.aggregate ||
    config.filters.some((f) => f.field && f.value.trim()) ||
    (config.sort?.field ?? "") !== (defaults.sort?.field ?? "") ||
    (config.sort?.direction ?? "asc") !==
      (defaults.sort?.direction ?? "asc") ||
    config.compareFields.join("|") !== defaults.compareFields.join("|")
  );
}

export const CHART_KIND_OPTIONS: {
  value: VisualizationKind;
  label: string;
}[] = [
  { value: "timeseries", label: "Timeseries" },
  { value: "bar", label: "Bar" },
  { value: "comparison", label: "Comparison" },
  { value: "sankey", label: "Sankey" },
];

export const AGGREGATE_OPTIONS: { value: VizExploreConfig["aggregate"]; label: string }[] =
  [
    { value: "sum", label: "Sum" },
    { value: "avg", label: "Average" },
    { value: "min", label: "Min" },
    { value: "max", label: "Max" },
    { value: "count", label: "Count" },
  ];

export const FILTER_OP_OPTIONS: {
  value: import("@/features/visualizer/explore/types").VizFilterOp;
  label: string;
}[] = [
  { value: "contains", label: "contains" },
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];
