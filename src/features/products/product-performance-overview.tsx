"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AdChannelProvider, PerformancePoint } from "@/domain";
import { LIVE_CHANNELS } from "@/features/channels/channel-catalog";
import {
  formatPerformanceMetric,
  PERFORMANCE_METRICS,
  type PerformanceMetricKey,
} from "@/features/reporting/performance-chart";
import { PerformanceChartLazy } from "@/features/reporting/performance-chart-lazy";
import {
  dateRangePresetLabel,
  formatDateInput,
  resolveDateRangeBounds,
} from "@/features/visualizer/explore/date-range";
import type { VizDateRangePreset } from "@/features/visualizer/explore/types";
import { cn } from "@/lib/utils";

type CampaignOption = {
  id: string;
  name: string;
  provider: AdChannelProvider;
  status: string | null;
};

type PerformanceResponse = {
  startDate: string;
  endDate: string;
  series: PerformancePoint[];
  totals: Omit<PerformancePoint, "date">;
  campaignCount: number;
  campaigns: CampaignOption[];
};

const DATE_PRESETS: VizDateRangePreset[] = [
  "last_7_days",
  "last_14_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "last_month",
];

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

function channelLabel(provider: AdChannelProvider): string {
  return LIVE_CHANNELS.find((c) => c.id === provider)?.name ?? provider;
}

function boundsForPreset(preset: VizDateRangePreset): {
  startDate: string;
  endDate: string;
} {
  const bounds = resolveDateRangeBounds({
    field: "date",
    preset,
    start: null,
    end: null,
  });
  if (!bounds) {
    const today = formatDateInput(new Date());
    return { startDate: today, endDate: today };
  }
  return {
    startDate: formatDateInput(bounds.start),
    endDate: formatDateInput(bounds.end),
  };
}

function MetricCard({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border px-3 py-3 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card/40 hover:bg-muted/50",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </button>
  );
}

function FilterPopover({
  label,
  summary,
  emptyLabel,
  children,
}: {
  label: string;
  summary: string;
  emptyLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-40 truncate">{summary || emptyLabel}</span>
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-56 p-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function ProductPerformanceOverview({
  productId,
}: {
  productId: string;
}) {
  const [datePreset, setDatePreset] =
    useState<VizDateRangePreset>("last_30_days");
  const [selectedMetric, setSelectedMetric] =
    useState<PerformanceMetricKey>("spend");
  const [selectedProviders, setSelectedProviders] = useState<
    AdChannelProvider[]
  >([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [dateOpen, setDateOpen] = useState(false);

  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(
    () => boundsForPreset(datePreset),
    [datePreset],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          productId,
          startDate,
          endDate,
          groupBy: "date",
        });
        if (selectedProviders.length > 0) {
          params.set("providers", selectedProviders.join(","));
        }
        if (selectedCampaignIds.length > 0) {
          params.set("campaignIds", selectedCampaignIds.join(","));
        }
        const res = await fetch(`/api/performance?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to load performance");
        }
        const json = (await res.json()) as PerformanceResponse;
        setData(json);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    productId,
    startDate,
    endDate,
    selectedProviders,
    selectedCampaignIds,
  ]);

  const allCampaigns = data?.campaigns ?? [];
  const availableProviders = useMemo(() => {
    const set = new Set(allCampaigns.map((c) => c.provider));
    return LIVE_CHANNELS.map((c) => c.id as AdChannelProvider).filter((id) =>
      set.has(id),
    );
  }, [allCampaigns]);

  const campaignsForFilter = useMemo(() => {
    if (selectedProviders.length === 0) return allCampaigns;
    const set = new Set(selectedProviders);
    return allCampaigns.filter((c) => set.has(c.provider));
  }, [allCampaigns, selectedProviders]);

  const allowedCampaignIds = useMemo(
    () => new Set(campaignsForFilter.map((c) => c.id)),
    [campaignsForFilter],
  );

  // Drop campaign selections that fall outside the current channel scope.
  useEffect(() => {
    setSelectedCampaignIds((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((id) => allowedCampaignIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [allowedCampaignIds]);

  const totals = data?.totals ?? {
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    revenue: 0,
  };
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  const metricValues: Record<PerformanceMetricKey, number> = {
    spend: totals.spend,
    revenue: totals.revenue,
    roas,
    conversions: totals.conversions,
    clicks: totals.clicks,
    impressions: totals.impressions,
  };

  const channelSummary =
    selectedProviders.length === 0
      ? "All channels"
      : selectedProviders.length === 1
        ? channelLabel(selectedProviders[0]!)
        : `${selectedProviders.length} channels`;

  const campaignSummary =
    selectedCampaignIds.length === 0
      ? "All campaigns"
      : selectedCampaignIds.length === 1
        ? (campaignsForFilter.find((c) => c.id === selectedCampaignIds[0])
            ?.name ?? "1 campaign")
        : `${selectedCampaignIds.length} campaigns`;

  const hasAnyCampaigns = allCampaigns.length > 0;
  const series = data?.series ?? [];

  return (
    <section id="performance" className="scroll-mt-16 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Performance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaign metrics across channels for this product.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPopover
            label="Channels"
            summary={
              selectedProviders.length === 0 ? "" : channelSummary
            }
            emptyLabel="All"
          >
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Channels
            </p>
            {availableProviders.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                No linked channels yet
              </p>
            ) : (
              <div className="space-y-0.5">
                <button
                  type="button"
                  className={optionItemClass}
                  onClick={() => setSelectedProviders([])}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      selectedProviders.length === 0
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  All channels
                </button>
                {availableProviders.map((provider) => {
                  const checked = selectedProviders.includes(provider);
                  return (
                    <label
                      key={provider}
                      className={cn(optionItemClass, "cursor-pointer")}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedProviders((prev) => {
                            const on = value === true;
                            if (on) {
                              return prev.includes(provider)
                                ? prev
                                : [...prev, provider];
                            }
                            return prev.filter((p) => p !== provider);
                          });
                        }}
                      />
                      {channelLabel(provider)}
                    </label>
                  );
                })}
              </div>
            )}
          </FilterPopover>

          <FilterPopover
            label="Campaigns"
            summary={
              selectedCampaignIds.length === 0 ? "" : campaignSummary
            }
            emptyLabel="All"
          >
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Campaigns
            </p>
            {campaignsForFilter.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                No campaigns in range
              </p>
            ) : (
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                <button
                  type="button"
                  className={optionItemClass}
                  onClick={() => setSelectedCampaignIds([])}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      selectedCampaignIds.length === 0
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  All campaigns
                </button>
                {campaignsForFilter.map((campaign) => {
                  const checked = selectedCampaignIds.includes(campaign.id);
                  return (
                    <label
                      key={campaign.id}
                      className={cn(optionItemClass, "cursor-pointer")}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedCampaignIds((prev) => {
                            const on = value === true;
                            if (on) {
                              return prev.includes(campaign.id)
                                ? prev
                                : [...prev, campaign.id];
                            }
                            return prev.filter((id) => id !== campaign.id);
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {campaign.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {channelLabel(campaign.provider)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </FilterPopover>

          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                />
              }
            >
              <CalendarDaysIcon className="size-3.5 opacity-70" />
              {dateRangePresetLabel(datePreset)}
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </PopoverTrigger>
            <PopoverContent align="end" className="min-w-48 p-2">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                Date range
              </p>
              <div className="space-y-0.5">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={optionItemClass}
                    onClick={() => {
                      setDatePreset(preset);
                      setDateOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        datePreset === preset ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {dateRangePresetLabel(preset)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!hasAnyCampaigns && !loading ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-4 py-10">
          <p className="text-sm text-muted-foreground">
            Connect an ad channel and sync campaigns to see product performance.
          </p>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/settings/connections" />}
          >
            Connect channels
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {PERFORMANCE_METRICS.map((metric) => (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={formatPerformanceMetric(
                  metric.key,
                  metricValues[metric.key],
                )}
                selected={selectedMetric === metric.key}
                onSelect={() => setSelectedMetric(metric.key)}
              />
            ))}
          </div>

          <div className="relative w-full min-w-0 rounded-lg border border-border bg-card/30 p-3 sm:p-4">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40 backdrop-blur-[1px]">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {PERFORMANCE_METRICS.find((m) => m.key === selectedMetric)
                  ?.label ?? "Metric"}{" "}
                · {dateRangePresetLabel(datePreset)}
              </p>
              {data ? (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {data.campaignCount} campaign
                  {data.campaignCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <PerformanceChartLazy data={series} metric={selectedMetric} />
          </div>
        </>
      )}
    </section>
  );
}
