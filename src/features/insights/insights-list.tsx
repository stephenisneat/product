"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Insight, InsightKind, InsightStatus } from "@/domain";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { InsightCard } from "@/features/insights/insight-card";

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
    <Accordion
      multiple
      defaultValue={[...INSIGHT_KIND_ORDER]}
      className="w-full"
    >
      {groups.map((group) => (
        <AccordionItem key={group.kind} value={group.kind}>
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {INSIGHT_KIND_LABELS[group.kind]}
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {group.insights.length}
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 [&_a]:no-underline">
            <ul className="space-y-3">
              {group.insights.map((insight) => (
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
                      insight.goalId
                        ? goalTitleById[insight.goalId] ?? null
                        : null
                    }
                  />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
