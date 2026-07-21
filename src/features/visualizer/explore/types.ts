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

/**
 * Live remapping of a visualization: pick any fields coming through,
 * filter/sort them, and encode into a chart kind.
 */
export type VizExploreConfig = {
  chartKind: VisualizationKind;
  xField: string;
  yField: string;
  /** Extra numeric fields to overlay for comparison. */
  compareFields: string[];
  /** Optional series / group-by field (category or string). */
  seriesField: string | null;
  aggregate: VizAggregate;
  filters: VizFilter[];
  sort: VizSort | null;
};

export type VizDataset = {
  fields: VizField[];
  rows: VizRow[];
  /** Original chart metric label when present. */
  metricLabel?: string;
};
