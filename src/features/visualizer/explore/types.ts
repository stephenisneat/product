import type { VisualizationKind } from "@/domain";

export type VizFieldType = "string" | "number" | "date" | "category";

export type VizField = {
  key: string;
  label: string;
  type: VizFieldType;
};

export type VizCell = string | number | null;
export type VizRow = Record<string, VizCell>;

export type VizFilterOp =
  | "eq"
  | "neq"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in";

export type VizFilter = {
  id: string;
  field: string;
  op: VizFilterOp;
  value: string;
};

export type VizSort = {
  field: string;
  direction: "asc" | "desc";
};

export type VizAggregate = "sum" | "avg" | "min" | "max" | "count";

/** Chart kinds plus table view for the explore canvas. */
export type VizDisplayKind = VisualizationKind | "table";

export type VizDateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_14_days"
  | "last_30_days"
  | "last_90_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export type VizDateRange = {
  field: string;
  preset: VizDateRangePreset;
  /** Inclusive custom start (YYYY-MM-DD). */
  start: string | null;
  /** Inclusive custom end (YYYY-MM-DD). */
  end: string | null;
};

/**
 * Live remapping of a visualization: pick any fields coming through,
 * filter/sort them, and encode into a chart kind.
 */
export type VizExploreConfig = {
  chartKind: VizDisplayKind;
  xField: string;
  yField: string;
  /** Extra numeric fields to overlay for comparison. */
  compareFields: string[];
  /** Optional series / group-by field (category or string). */
  seriesField: string | null;
  aggregate: VizAggregate;
  filters: VizFilter[];
  sort: VizSort | null;
  /** Optional date window applied before chart rebuild. */
  dateRange: VizDateRange | null;
};

export type VizDataset = {
  fields: VizField[];
  rows: VizRow[];
  /** Original chart metric label when present. */
  metricLabel?: string;
};
