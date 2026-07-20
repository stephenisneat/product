"use client";

import { useState } from "react";
import { LockIcon } from "lucide-react";
import type { Goal, Insight, WorkspacePlan } from "@/domain";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { InsightsList } from "@/features/insights/insights-list";
import type {
  InsightsSortKey,
  InsightsStatusFilter,
} from "@/features/insights/insights-list";
import { InsightsToolbar } from "@/features/insights/insights-toolbar";

export function InsightsPageClient({
  plan,
  locked,
  goals,
  insights,
  products,
}: {
  plan: WorkspacePlan;
  locked: boolean;
  goals: Goal[];
  insights: Insight[];
  products: { id: string; title: string }[];
}) {
  const [statusFilter, setStatusFilter] =
    useState<InsightsStatusFilter>("all");
  const [sort, setSort] = useState<InsightsSortKey>("newest");

  const productTitleById = Object.fromEntries(
    products.map((p) => [p.id, p.title]),
  );
  const goalTitleById = Object.fromEntries(goals.map((g) => [g.id, g.title]));

  return (
    <>
      <InsightsToolbar
        plan={plan}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sort={sort}
        onSortChange={setSort}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {locked ? (
          <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--color-foreground) 8%, transparent) 0, transparent 42%), radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--color-foreground) 6%, transparent) 0, transparent 45%)",
              }}
            />
            <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                <LockIcon className="size-5 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Insights are locked
              </h2>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro to unlock product and marketing insights for this
                workspace.
              </p>
              <UpgradeButton size="sm" className="mt-1">
                Upgrade to Pro
              </UpgradeButton>
            </div>
          </div>
        ) : (
          <InsightsList
            initialInsights={insights}
            productTitleById={productTitleById}
            goalTitleById={goalTitleById}
            statusFilter={statusFilter}
            sort={sort}
          />
        )}
      </div>
    </>
  );
}
