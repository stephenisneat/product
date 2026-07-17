"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import type { Workspace, WorkspacePlan, WorkspaceRole } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ANNUAL_DISCOUNT,
  PLAN_ENTITLEMENTS,
  clampSeatCount,
  effectiveMonthlyCentsPerSeat,
  featureBullets,
  formatUsd,
  getEntitlements,
  priceCentsPerSeat,
  type BillingInterval,
  type PaidPlan,
} from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

function planBadgeClass(plan: WorkspacePlan) {
  const color = getEntitlements(plan).badgeColor;
  if (color === "green") {
    return "border-green-500/30 bg-green-500/40 text-green-900 dark:text-green-100 font-semibold";
  }
  if (color === "blue") {
    return "border-blue-500/30 bg-blue-500/40 text-blue-800 dark:text-blue-100 font-semibold";
  }
  return "border-yellow-500/30 bg-yellow-500/40 text-yellow-800 dark:text-yellow-100 font-semibold";
}

const PLAN_ORDER: WorkspacePlan[] = ["free", "hobby", "pro"];

export function BillingPanel({
  workspace,
  role,
  memberCount = 1,
  compact = false,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
  memberCount?: number;
  /** Tighter layout for dialog overlay. */
  compact?: boolean;
}) {
  const router = useRouter();
  const isOwner = role === "owner";
  const currentPlan = workspace.plan ?? "free";
  const [interval, setInterval] = useState<BillingInterval>(
    workspace.billingInterval === "year" ? "year" : "month",
  );
  const [seats, setSeats] = useState(
    clampSeatCount(workspace.billedSeats || memberCount || 1),
  );
  const [busyPlan, setBusyPlan] = useState<PaidPlan | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout(plan: PaidPlan) {
    if (!isOwner) return;
    setBusyPlan(plan);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, seats }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    if (!isOwner) return;
    setPortalBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to open billing portal");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
      setPortalBusy(false);
    }
  }

  return (
    <div className={cn("space-y-6", !compact && "space-y-8")}>
      {!compact ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Current plan</h2>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 px-1.5 text-[11px]",
                planBadgeClass(currentPlan),
              )}
            >
              {getEntitlements(currentPlan).name}
            </Badge>
            {workspace.billingInterval ? (
              <span className="text-xs text-muted-foreground">
                · billed {workspace.billingInterval}ly ·{" "}
                {workspace.billedSeats ?? 1} seat
                {(workspace.billedSeats ?? 1) === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Per-seat pricing. Included AI usage scales with seats and unused
            allotment rolls over (capped at one month).
          </p>
          {isOwner && currentPlan !== "free" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={portalBusy}
              onClick={() => void openPortal()}
            >
              {portalBusy ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Manage subscription
            </Button>
          ) : null}
          {!isOwner ? (
            <p className="text-xs text-muted-foreground">
              Only the workspace owner can change the plan.
            </p>
          ) : null}
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn("h-5 px-1.5 text-[11px]", planBadgeClass(currentPlan))}
          >
            {getEntitlements(currentPlan).name}
          </Badge>
          <span className="text-xs text-muted-foreground">Current plan</span>
          {isOwner && currentPlan !== "free" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto h-7 px-2 text-xs"
              disabled={portalBusy}
              onClick={() => void openPortal()}
            >
              Manage subscription
            </Button>
          ) : null}
        </div>
      )}

      {isOwner ? (
        <section className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Billing</p>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  interval === "month"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setInterval("month")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  interval === "year"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setInterval("year")}
              >
                Annual
                <span className="ml-1 text-[10px] opacity-80">
                  −{Math.round(ANNUAL_DISCOUNT * 100)}%
                </span>
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="billing-seats"
              className="text-xs font-medium text-muted-foreground"
            >
              Seats
            </label>
            <input
              id="billing-seats"
              type="number"
              min={1}
              max={500}
              value={seats}
              onChange={(e) =>
                setSeats(clampSeatCount(Number(e.target.value) || 1))
              }
              className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {memberCount} member{memberCount === 1 ? "" : "s"} today
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const e = PLAN_ENTITLEMENTS[plan];
          const isCurrent =
            plan === currentPlan &&
            (plan === "free" ||
              (workspace.billingInterval ?? "month") === interval);
          const isPaid = plan === "hobby" || plan === "pro";
          const canSelect =
            isOwner && isPaid && busyPlan === null;
          const perSeat =
            interval === "year"
              ? effectiveMonthlyCentsPerSeat(plan)
              : e.priceCentsPerSeatMonthly;
          const periodTotal = isPaid
            ? priceCentsPerSeat(plan, interval) * seats
            : 0;

          return (
            <div
              key={plan}
              className={cn(
                "flex flex-col rounded-lg border p-4",
                isCurrent && "border-foreground/30 bg-muted/30",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 px-1.5 text-[11px]",
                    planBadgeClass(plan),
                  )}
                >
                  {e.name}
                </Badge>
                {isCurrent ? (
                  <span className="text-[11px] text-muted-foreground">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {formatUsd(perSeat)}
                <span className="text-sm font-normal text-muted-foreground">
                  /seat/mo
                </span>
              </p>
              {isPaid && interval === "year" ? (
                <p className="text-[11px] text-muted-foreground">
                  {formatUsd(periodTotal)} billed annually
                </p>
              ) : isPaid ? (
                <p className="text-[11px] text-muted-foreground">
                  {formatUsd(periodTotal)} / mo for {seats} seat
                  {seats === 1 ? "" : "s"}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Forever free · top-offs available
                </p>
              )}
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                {featureBullets(plan, { seats }).map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <CheckIcon className="mt-0.5 size-3 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {isPaid ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 w-full"
                  disabled={!canSelect || busyPlan === plan}
                  variant={plan === "pro" ? "default" : "outline"}
                  onClick={() => void startCheckout(plan)}
                >
                  {busyPlan === plan ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  {isCurrent ? "Current plan" : `Upgrade to ${e.name}`}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 w-full"
                  variant="ghost"
                  disabled
                >
                  {isCurrent ? "Current plan" : "Included"}
                </Button>
              )}
            </div>
          );
        })}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Plans are billed per seat. Included usage resets monthly with rollover
          (up to one month).{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => router.push("/wallet/transactions")}
          >
            View usage history
          </button>
        </p>
      ) : !isOwner ? (
        <p className="text-xs text-muted-foreground">
          Only the workspace owner can change the plan.
        </p>
      ) : null}
    </div>
  );
}
