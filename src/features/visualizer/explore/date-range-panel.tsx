"use client";

import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATE_RANGE_PRESETS,
  emptyDateRange,
  formatDateInput,
  resolveDateRangeBounds,
} from "@/features/visualizer/explore/date-range";
import type {
  VizDataset,
  VizDateRange,
  VizDateRangePreset,
  VizExploreConfig,
  VizField,
} from "@/features/visualizer/explore/types";
import { cn } from "@/lib/utils";

const presetButtonClass =
  "rounded-md border border-border px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground";

function FieldSelect({
  value,
  onChange,
  fields,
}: {
  value: string;
  onChange: (value: string) => void;
  fields: VizField[];
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next == null) return;
        onChange(next);
      }}
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue placeholder="Date field" />
      </SelectTrigger>
      <SelectContent align="start">
        {fields.map((field) => (
          <SelectItem key={field.key} value={field.key}>
            {field.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangePanel({
  config,
  dataset,
  onChange,
}: {
  config: VizExploreConfig;
  dataset: VizDataset;
  onChange: (next: VizExploreConfig) => void;
}) {
  const dateFields = dataset.fields.filter((f) => f.type === "date");
  const defaultField = dateFields[0]?.key ?? "date";
  const range: VizDateRange = config.dateRange ?? emptyDateRange(defaultField);
  const bounds =
    range.preset !== "all" && range.preset !== "custom"
      ? resolveDateRangeBounds(range)
      : null;

  function updateRange(patch: Partial<VizDateRange>) {
    const next: VizDateRange = {
      ...range,
      ...patch,
      field: patch.field ?? range.field ?? defaultField,
    };
    onChange({
      ...config,
      dateRange:
        next.preset === "all" && !next.start && !next.end ? null : next,
    });
  }

  function selectPreset(preset: VizDateRangePreset) {
    if (preset === "custom") {
      const resolved = resolveDateRangeBounds({
        ...range,
        preset: range.preset === "all" ? "last_30_days" : range.preset,
      });
      updateRange({
        preset: "custom",
        start:
          range.start ??
          (resolved ? formatDateInput(resolved.start) : formatDateInput(new Date())),
        end:
          range.end ??
          (resolved ? formatDateInput(resolved.end) : formatDateInput(new Date())),
      });
      return;
    }
    if (preset === "all") {
      onChange({ ...config, dateRange: null });
      return;
    }
    updateRange({ preset, start: null, end: null });
  }

  if (dateFields.length === 0) {
    return (
      <div className="w-[min(92vw,320px)]">
        <p className="text-xs text-muted-foreground">
          No date fields in this feed. Date range filtering is unavailable.
        </p>
      </div>
    );
  }

  const trailing = DATE_RANGE_PRESETS.filter((p) => p.group === "trailing");
  const calendar = DATE_RANGE_PRESETS.filter((p) => p.group === "calendar");

  return (
    <div className="flex w-[min(92vw,340px)] flex-col gap-3">
      {dateFields.length > 1 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Date field
          </p>
          <FieldSelect
            value={range.field}
            fields={dateFields}
            onChange={(field) => updateRange({ field })}
          />
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Trailing
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {trailing.map((opt) => {
            const active = range.preset === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  presetButtonClass,
                  active && "border-foreground/30 bg-accent text-accent-foreground",
                )}
                onClick={() => selectPreset(opt.value)}
              >
                <span className="flex items-center gap-1.5">
                  <CheckIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Calendar
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {calendar.map((opt) => {
            const active = range.preset === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  presetButtonClass,
                  active && "border-foreground/30 bg-accent text-accent-foreground",
                )}
                onClick={() => selectPreset(opt.value)}
              >
                <span className="flex items-center gap-1.5">
                  <CheckIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Custom</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => selectPreset("all")}
          >
            Clear
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">From</span>
            <Input
              type="date"
              value={
                range.preset === "custom"
                  ? (range.start ?? "")
                  : bounds
                    ? formatDateInput(bounds.start)
                    : ""
              }
              onChange={(e) => {
                const start = e.target.value || null;
                updateRange({
                  preset: "custom",
                  start,
                  end: range.end ?? (bounds ? formatDateInput(bounds.end) : start),
                });
              }}
              className="h-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">To</span>
            <Input
              type="date"
              value={
                range.preset === "custom"
                  ? (range.end ?? "")
                  : bounds
                    ? formatDateInput(bounds.end)
                    : ""
              }
              onChange={(e) => {
                const end = e.target.value || null;
                updateRange({
                  preset: "custom",
                  start:
                    range.start ??
                    (bounds ? formatDateInput(bounds.start) : end),
                  end,
                });
              }}
              className="h-8 text-xs"
            />
          </label>
        </div>
        {range.preset !== "custom" && bounds ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Resolves to {formatDateInput(bounds.start)} →{" "}
            {formatDateInput(bounds.end)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
