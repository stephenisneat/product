"use client";

import { useState } from "react";
import { CalendarDaysIcon, CheckIcon, ListFilterIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { JobRunStatus } from "@/domain";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";
import { cn } from "@/lib/utils";

export type JobsStatusFilter = "all" | JobRunStatus;

export type JobsDateRange =
  | "all"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

const STATUS_FILTERS: { value: JobsStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "canceled", label: "Canceled" },
];

const DATE_RANGES: { value: JobsDateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
];

export function JobsToolbar({
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
}: {
  statusFilter: JobsStatusFilter;
  onStatusFilterChange: (value: JobsStatusFilter) => void;
  dateRange: JobsDateRange;
  onDateRangeChange: (value: JobsDateRange) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <CatalogHeaderActions>
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="aspect-square"
              aria-label="Filter jobs"
            />
          }
        >
          <ListFilterIcon />
        </PopoverTrigger>
        <PopoverContent align="end" className="min-w-48 p-2">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Status
          </p>
          <div className="space-y-0.5">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={optionItemClass}
                onClick={() => {
                  onStatusFilterChange(option.value);
                  setFilterOpen(false);
                }}
              >
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    statusFilter === option.value ? "opacity-100" : "opacity-0",
                  )}
                />
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="aspect-square"
              aria-label="Filter by date"
            />
          }
        >
          <CalendarDaysIcon />
        </PopoverTrigger>
        <PopoverContent align="end" className="min-w-48 p-2">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Date
          </p>
          <div className="space-y-0.5">
            {DATE_RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={optionItemClass}
                onClick={() => {
                  onDateRangeChange(option.value);
                  setDateOpen(false);
                }}
              >
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    dateRange === option.value ? "opacity-100" : "opacity-0",
                  )}
                />
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </CatalogHeaderActions>
  );
}
