"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Insight, InsightKind, InsightStatus } from "@/domain";
import { ChevronDownIcon } from "@/components/icons";
import { InsightCard } from "@/features/insights/insight-card";
import { cn } from "@/lib/utils";

export type InsightsSortKey =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc";

export type InsightsStatusFilter =
  | "all"
  | "awaiting_review"
  | "accepted"
  | "generating"
  | "failed";

export const INSIGHT_KIND_ORDER: InsightKind[] = [
  "blocker",
  "opportunity",
  "idea",
  "setup",
];

export const INSIGHT_KIND_LABELS: Record<InsightKind, string> = {
  blocker: "Blocker",
  opportunity: "Opportunity",
  idea: "Idea",
  setup: "Setup",
};

function sortInsights(
  list: Insight[],
  sort: InsightsSortKey,
): Insight[] {
  const copy = [...list];
  switch (sort) {
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "title-asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return copy.sort((a, b) => b.title.localeCompare(a.title));
    case "newest":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

function filterInsights(
  list: Insight[],
  status: InsightsStatusFilter,
): Insight[] {
  if (status === "all") return list;
  return list.filter((i) => i.status === (status as InsightStatus));
}

function InsightKindGroup({
  kind,
  insights,
  productTitleById,
  goalTitleById,
}: {
  kind: InsightKind;
  insights: Insight[];
  productTitleById: Record<string, string>;
  goalTitleById: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const label = INSIGHT_KIND_LABELS[kind];

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md py-1 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {insights.length}
        </span>
      </button>
      {open ? (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li key={insight.id}>
              <InsightCard
                insight={insight}
                pollWhileGenerating={false}
                productTitle={
                  insight.productId
                    ? productTitleById[insight.productId] ?? null
                    : null
                }
                goalTitle={
                  insight.goalId ? goalTitleById[insight.goalId] ?? null : null
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * List view that coalesces generating-insight polls into one workspace fetch.
 * Groups by kind (Blocker / Opportunity / Idea / Setup); status stays a filter.
 */
export function InsightsList({
  initialInsights,
  productTitleById,
  goalTitleById,
  statusFilter = "all",
  sort = "newest",
}: {
  initialInsights: Insight[];
  productTitleById: Record<string, string>;
  goalTitleById: Record<string, string>;
  statusFilter?: InsightsStatusFilter;
  sort?: InsightsSortKey;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [insights, setInsights] = useState(initialInsights);
  const hasGenerating = insights.some((i) => i.status === "generating");

  useEffect(() => {
    setInsights(initialInsights);
  }, [initialInsights]);

  useEffect(() => {
    if (!hasGenerating) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/insights");
        if (!res.ok) return;
        const body = (await res.json()) as { insights?: Insight[] };
        if (cancelled || !body.insights) return;
        setInsights(body.insights);
        if (!body.insights.some((i) => i.status === "generating")) {
          startTransition(() => router.refresh());
        }
      } catch {
        // ignore poll errors
      }
    };

    const id = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasGenerating, router]);

  const visible = useMemo(
    () => sortInsights(filterInsights(insights, statusFilter), sort),
    [insights, statusFilter, sort],
  );

  const groups = useMemo(
    () =>
      INSIGHT_KIND_ORDER.map((kind) => ({
        kind,
        insights: visible.filter((i) => i.kind === kind),
      })).filter((group) => group.insights.length > 0),
    [visible],
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No insights match this filter. Generate one or wait for a job/heartbeat.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <InsightKindGroup
          key={group.kind}
          kind={group.kind}
          insights={group.insights}
          productTitleById={productTitleById}
          goalTitleById={goalTitleById}
        />
      ))}
    </div>
  );
}
