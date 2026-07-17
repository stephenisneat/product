"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  CheckIcon,
  ListFilterIcon,
  LockOpenIcon,
} from "lucide-react";
import type { WorkspacePlan } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CatalogNav } from "@/features/products/catalog-toolbar";
import { cn } from "@/lib/utils";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

const insightsCtaButtonClass =
  "border-0 bg-[#288DFF] bg-clip-border text-white shadow-[0_0_0_1px_#288DFF,0_1px_2px_0_rgba(14,18,27,0.24),inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-[#1f7ff5] hover:text-white focus-visible:border-transparent focus-visible:ring-0 aria-expanded:bg-[#288DFF] aria-expanded:text-white dark:bg-[#288DFF] dark:text-white dark:hover:bg-[#1f7ff5]";

type StatusFilter = "all" | "ready" | "generating" | "failed";
type SortKey = "newest" | "oldest" | "title-asc" | "title-desc";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "Ready" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

export function InsightsToolbar({
  plan = "free",
}: {
  plan?: WorkspacePlan;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const showUnlock = plan !== "pro";

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <CatalogNav />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="aspect-square"
                aria-label="Filter insights"
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
                  onClick={() => setStatusFilter(option.value)}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      statusFilter === option.value
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="aspect-square"
                aria-label="Sort insights"
              />
            }
          >
            <ArrowUpDownIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="min-w-48 p-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Sort by
            </p>
            <div className="space-y-0.5">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={optionItemClass}
                  onClick={() => {
                    setSort(option.value);
                    setSortOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      sort === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {showUnlock ? (
          <Tooltip>
            <TooltipTrigger
              delay={50}
              closeOnClick={false}
              render={
                <Button
                  render={<Link href="/settings/billing" />}
                  size="sm"
                  className={insightsCtaButtonClass}
                />
              }
            >
              <LockOpenIcon data-icon="inline-start" />
              Unlock insights
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              Insights are included on the Pro plan.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
