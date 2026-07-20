"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDownIcon,
  CheckIcon,
  ListFilterIcon,
  LockOpenIcon,
  SparklesIcon,
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
import { UpgradeButton } from "@/features/billing/upgrade-button";
import type {
  InsightsSortKey,
  InsightsStatusFilter,
} from "@/features/insights/insights-list";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";
import { cn } from "@/lib/utils";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

const insightsCtaButtonClass =
  "border-0 bg-[#288DFF] bg-clip-border text-white shadow-[0_0_0_1px_#288DFF,0_1px_2px_0_rgba(14,18,27,0.24),inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-[#1f7ff5] hover:text-white focus-visible:border-transparent focus-visible:ring-0 aria-expanded:bg-[#288DFF] aria-expanded:text-white dark:bg-[#288DFF] dark:text-white dark:hover:bg-[#1f7ff5]";

const STATUS_FILTERS: { value: InsightsStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "awaiting_review", label: "Awaiting review" },
  { value: "accepted", label: "Accepted" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
];

const SORT_OPTIONS: { value: InsightsSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

export function InsightsToolbar({
  plan = "free",
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  canGenerate = false,
}: {
  plan?: WorkspacePlan;
  statusFilter: InsightsStatusFilter;
  onStatusFilterChange: (value: InsightsStatusFilter) => void;
  sort: InsightsSortKey;
  onSortChange: (value: InsightsSortKey) => void;
  canGenerate?: boolean;
}) {
  const router = useRouter();
  const [sortOpen, setSortOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const showUnlock = plan !== "pro";

  async function generate() {
    setGenError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setGenError(body?.error ?? "Failed to generate");
        return;
      }
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <CatalogHeaderActions>
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
                onClick={() => onStatusFilterChange(option.value)}
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
                  onSortChange(option.value);
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

      {canGenerate ? (
        <Tooltip>
          <TooltipTrigger
            delay={50}
            closeOnClick={false}
            render={
              <Button
                type="button"
                size="sm"
                className={insightsCtaButtonClass}
                disabled={generating}
                onClick={() => void generate()}
              />
            }
          >
            <SparklesIcon data-icon="inline-start" />
            {generating ? "Generating…" : "Generate"}
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            {genError ?? "Generate a new insight from your goals."}
          </TooltipContent>
        </Tooltip>
      ) : null}

      {showUnlock ? (
        <Tooltip>
          <TooltipTrigger
            delay={50}
            closeOnClick={false}
            render={
              <UpgradeButton
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
    </CatalogHeaderActions>
  );
}
