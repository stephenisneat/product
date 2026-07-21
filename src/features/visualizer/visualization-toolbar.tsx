"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDownIcon,
  Columns3Icon,
  GitCompareArrowsIcon,
  ListFilterIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  TableIcon,
  XIcon,
} from "@/components/icons";
import type { VisualizationKind } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGGREGATE_OPTIONS,
  CHART_KIND_OPTIONS,
  FILTER_OP_OPTIONS,
  exploreConfigIsActive,
} from "@/features/visualizer/explore/defaults";
import { uniqueValues } from "@/features/visualizer/explore/flatten";
import { newFilterId } from "@/features/visualizer/explore/transform";
import type {
  VizDataset,
  VizExploreConfig,
  VizField,
  VizFilter,
  VizFilterOp,
} from "@/features/visualizer/explore/types";
import { cn } from "@/lib/utils";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

function FieldSelect({
  value,
  onChange,
  fields,
  allowNone,
  noneLabel = "None",
  placeholder = "Field",
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  fields: VizField[];
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const selectValue = value ?? (allowNone ? "__none__" : "");
  return (
    <Select
      value={selectValue}
      onValueChange={(next) => {
        if (next == null) return;
        onChange(next === "__none__" ? null : next);
      }}
    >
      <SelectTrigger size="sm" className={cn("min-w-28", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start">
        {allowNone ? (
          <SelectItem value="__none__">{noneLabel}</SelectItem>
        ) : null}
        {fields.map((field) => (
          <SelectItem key={field.key} value={field.key}>
            {field.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DataFieldsPanel({
  dataset,
  filteredCount,
}: {
  dataset: VizDataset;
  filteredCount: number;
}) {
  const previewRows = dataset.rows.slice(0, 8);
  return (
    <div className="flex max-h-[420px] w-[min(92vw,560px)] flex-col gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Fields in this feed · {dataset.rows.length} rows
          {filteredCount !== dataset.rows.length
            ? ` · ${filteredCount} after filters`
            : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dataset.fields.map((field) => (
            <Badge key={field.key} variant="outline" className="font-normal">
              <span className="text-foreground">{field.label}</span>
              <span className="text-muted-foreground">{field.type}</span>
            </Badge>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-popover">
            <tr className="border-b border-border">
              {dataset.fields.map((field) => (
                <th
                  key={field.key}
                  className="whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground"
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {dataset.fields.map((field) => (
                  <td
                    key={field.key}
                    className="max-w-[140px] truncate px-2 py-1 tabular-nums text-foreground/90"
                    title={String(row[field.key] ?? "")}
                  >
                    {row[field.key] == null ? "—" : String(row[field.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dataset.rows.length > previewRows.length ? (
        <p className="text-[11px] text-muted-foreground">
          Showing first {previewRows.length} of {dataset.rows.length} rows
        </p>
      ) : null}
    </div>
  );
}

function FilterBuilder({
  config,
  dataset,
  onChange,
}: {
  config: VizExploreConfig;
  dataset: VizDataset;
  onChange: (next: VizExploreConfig) => void;
}) {
  function updateFilter(id: string, patch: Partial<VizFilter>) {
    onChange({
      ...config,
      filters: config.filters.map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    });
  }

  function removeFilter(id: string) {
    onChange({
      ...config,
      filters: config.filters.filter((f) => f.id !== id),
    });
  }

  function addFilter() {
    const field = dataset.fields[0]?.key ?? "value";
    onChange({
      ...config,
      filters: [
        ...config.filters,
        {
          id: newFilterId(),
          field,
          op: "contains",
          value: "",
        },
      ],
    });
  }

  return (
    <div className="flex w-[min(92vw,420px)] flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Filters</p>
      {config.filters.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No filters yet. Narrow any field coming through the feed.
        </p>
      ) : (
        <div className="space-y-2">
          {config.filters.map((filter) => {
            const suggestions = uniqueValues(dataset.rows, filter.field, 12);
            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <FieldSelect
                    value={filter.field}
                    onChange={(field) =>
                      updateFilter(filter.id, { field: field ?? "" })
                    }
                    fields={dataset.fields}
                    className="min-w-0 flex-1"
                  />
                  <Select
                    value={filter.op}
                    onValueChange={(op) => {
                      if (op == null) return;
                      updateFilter(filter.id, { op: op as VizFilterOp });
                    }}
                  >
                    <SelectTrigger size="sm" className="w-28 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OP_OPTIONS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove filter"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <XIcon />
                  </Button>
                </div>
                <Input
                  value={filter.value}
                  onChange={(e) =>
                    updateFilter(filter.id, { value: e.target.value })
                  }
                  placeholder="Value"
                  className="h-7 text-xs"
                  list={`viz-filter-${filter.id}`}
                />
                <datalist id={`viz-filter-${filter.id}`}>
                  {suggestions.map((v) => (
                    <option key={String(v)} value={String(v)} />
                  ))}
                </datalist>
              </div>
            );
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={addFilter}
      >
        <PlusIcon data-icon="inline-start" />
        Add filter
      </Button>
    </div>
  );
}

function ComparePanel({
  config,
  dataset,
  onChange,
}: {
  config: VizExploreConfig;
  dataset: VizDataset;
  onChange: (next: VizExploreConfig) => void;
}) {
  const numberFields = dataset.fields.filter((f) => f.type === "number");
  const categoryFields = dataset.fields.filter(
    (f) => f.type === "category" || f.type === "string" || f.type === "date",
  );

  function toggleCompare(fieldKey: string, checked: boolean) {
    const without = config.compareFields.filter((k) => k !== fieldKey);
    if (fieldKey === config.yField) return;
    onChange({
      ...config,
      compareFields: checked ? [...without, fieldKey] : without,
      // Multi-metric compare works best without a series split.
      seriesField:
        checked || without.length > 0 ? null : config.seriesField,
    });
  }

  return (
    <div className="flex w-[min(92vw,320px)] flex-col gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Primary metric
        </p>
        <FieldSelect
          value={config.yField}
          onChange={(yField) =>
            onChange({
              ...config,
              yField: yField ?? config.yField,
              compareFields: config.compareFields.filter((k) => k !== yField),
            })
          }
          fields={numberFields}
          className="mt-1 w-full"
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Compare metrics
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {numberFields
            .filter((f) => f.key !== config.yField)
            .map((field) => {
              const checked = config.compareFields.includes(field.key);
              return (
                <label
                  key={field.key}
                  className={cn(optionItemClass, "cursor-pointer")}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleCompare(field.key, value === true)
                    }
                  />
                  <span>{field.label}</span>
                </label>
              );
            })}
          {numberFields.filter((f) => f.key !== config.yField).length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              No additional numeric fields to compare.
            </p>
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Split by series
        </p>
        <FieldSelect
          value={config.seriesField}
          onChange={(seriesField) =>
            onChange({
              ...config,
              seriesField,
              compareFields:
                seriesField != null ? [] : config.compareFields,
            })
          }
          fields={categoryFields}
          allowNone
          noneLabel="No split"
          className="mt-1 w-full"
        />
      </div>
    </div>
  );
}

function EncodePanel({
  config,
  dataset,
  onChange,
}: {
  config: VizExploreConfig;
  dataset: VizDataset;
  onChange: (next: VizExploreConfig) => void;
}) {
  const categoryFields = dataset.fields.filter(
    (f) => f.type === "category" || f.type === "string" || f.type === "date",
  );
  const numberFields = dataset.fields.filter((f) => f.type === "number");

  return (
    <div className="flex w-[min(92vw,300px)] flex-col gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Chart type</p>
        <Select
          value={config.chartKind}
          onValueChange={(chartKind) => {
            if (chartKind == null) return;
            onChange({
              ...config,
              chartKind: chartKind as VisualizationKind,
            });
          }}
        >
          <SelectTrigger size="sm" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {config.chartKind === "sankey" ? "Source" : "X axis"}
        </p>
        <FieldSelect
          value={config.xField}
          onChange={(xField) =>
            onChange({ ...config, xField: xField ?? config.xField })
          }
          fields={categoryFields.length > 0 ? categoryFields : dataset.fields}
          className="mt-1 w-full"
        />
      </div>
      {config.chartKind === "sankey" ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Target</p>
          <FieldSelect
            value={config.seriesField}
            onChange={(seriesField) => onChange({ ...config, seriesField })}
            fields={categoryFields}
            className="mt-1 w-full"
          />
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-muted-foreground">Aggregate</p>
        <Select
          value={config.aggregate}
          onValueChange={(aggregate) => {
            if (aggregate == null) return;
            onChange({
              ...config,
              aggregate: aggregate as VizExploreConfig["aggregate"],
            });
          }}
        >
          <SelectTrigger size="sm" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Y metric</p>
        <FieldSelect
          value={config.yField}
          onChange={(yField) =>
            onChange({
              ...config,
              yField: yField ?? config.yField,
              compareFields: config.compareFields.filter((k) => k !== yField),
            })
          }
          fields={numberFields}
          className="mt-1 w-full"
        />
      </div>
    </div>
  );
}

export function VisualizationToolbar({
  dataset,
  config,
  defaults,
  filteredRowCount,
  canSave,
  onChange,
  onReset,
  onSave,
}: {
  dataset: VizDataset;
  config: VizExploreConfig;
  defaults: VizExploreConfig;
  filteredRowCount: number;
  canSave: boolean;
  onChange: (next: VizExploreConfig) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const [dataOpen, setDataOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [encodeOpen, setEncodeOpen] = useState(false);

  const dirty = exploreConfigIsActive(config, defaults);
  const activeFilters = config.filters.filter(
    (f) => f.field && f.value.trim() !== "",
  ).length;

  const sortFields = useMemo(() => dataset.fields, [dataset.fields]);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-neutral-900/80 px-3 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover open={dataOpen} onOpenChange={setDataOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Browse data fields"
              />
            }
          >
            <TableIcon data-icon="inline-start" />
            Data
            <Badge variant="secondary" className="ml-0.5 font-normal">
              {dataset.fields.length}
            </Badge>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <DataFieldsPanel
              dataset={dataset}
              filteredCount={filteredRowCount}
            />
          </PopoverContent>
        </Popover>

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Filter data"
              />
            }
          >
            <ListFilterIcon data-icon="inline-start" />
            Filter
            {activeFilters > 0 ? (
              <Badge variant="secondary" className="ml-0.5 font-normal">
                {activeFilters}
              </Badge>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <FilterBuilder
              config={config}
              dataset={dataset}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Sort data"
              />
            }
          >
            <ArrowUpDownIcon data-icon="inline-start" />
            Sort
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Sort by
            </p>
            <div className="flex flex-col gap-2">
              <FieldSelect
                value={config.sort?.field ?? null}
                onChange={(field) =>
                  onChange({
                    ...config,
                    sort: field
                      ? {
                          field,
                          direction: config.sort?.direction ?? "asc",
                        }
                      : null,
                  })
                }
                fields={sortFields}
                allowNone
                noneLabel="No sort"
                className="w-full"
              />
              <Select
                value={config.sort?.direction ?? "asc"}
                onValueChange={(direction) => {
                  if (direction == null || !config.sort?.field) return;
                  onChange({
                    ...config,
                    sort: {
                      field: config.sort.field,
                      direction: direction as "asc" | "desc",
                    },
                  });
                }}
                disabled={!config.sort?.field}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={compareOpen} onOpenChange={setCompareOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Compare metrics"
              />
            }
          >
            <GitCompareArrowsIcon data-icon="inline-start" />
            Compare
            {config.compareFields.length > 0 ? (
              <Badge variant="secondary" className="ml-0.5 font-normal">
                {config.compareFields.length + 1}
              </Badge>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <ComparePanel
              config={config}
              dataset={dataset}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>

        <Popover open={encodeOpen} onOpenChange={setEncodeOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Map chart fields"
              />
            }
          >
            <Columns3Icon data-icon="inline-start" />
            Encode
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <EncodePanel
              config={config}
              dataset={dataset}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {filteredRowCount}/{dataset.rows.length} rows · {config.chartKind}
          </span>
          {dirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              aria-label="Reset exploration"
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
          ) : null}
          <Button
            type="button"
            variant={canSave ? "default" : "outline"}
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            aria-label="Save visualization"
          >
            <SaveIcon data-icon="inline-start" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
