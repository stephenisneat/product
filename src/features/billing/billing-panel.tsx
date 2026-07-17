"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import type { Workspace, WorkspacePlan, WorkspaceRole } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PLAN_ENTITLEMENTS,
  getEntitlements,
  type PaidPlan,
} from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

function formatUsd(cents: number) {
  if (cents === 0) return "$0";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

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

function featureBullets(plan: WorkspacePlan): string[] {
  const e = getEntitlements(plan);
  const bullets: string[] = [
    `${formatUsd(e.includedUsageCents)} AI usage included / mo`,
  ];
  if (e.allowUsageTopOff) {
    bullets.push("Top off credits after included usage");
  } else {
    bullets.push("No credit top-offs (upgrade to continue)");
  }
  if (e.maxCampaignsPerProduct === null) {
    bullets.push("Unlimited campaigns per product");
  } else if (e.maxCampaignsPerProduct === 0) {
    bullets.push("Campaign concepts only (no launch)");
  } else {
    bullets.push(`Up to ${e.maxCampaignsPerProduct} campaigns per product`);
  }
  if (e.canSpendAndLaunch) {
    bullets.push("Add ad spend & launch campaigns");
  } else {
    bullets.push("Ad spend & launch locked");
  }
  if (e.hasInsights) {
    bullets.push("Insights unlocked");
  } else {
    bullets.push("Insights locked");
  }
  if (plan === "pro") {
    bullets.push("Better AI rates (~20% more usage per dollar)");
  }
  return bullets;
}

export function BillingPanel({
  workspace,
  role,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
}) {
  const router = useRouter();
  const isOwner = role === "owner";
  const currentPlan = workspace.plan ?? "free";
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
        body: JSON.stringify({ plan }),
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
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Current plan</h2>
          <Badge
            variant="secondary"
            className={cn("h-5 px-1.5 text-[11px]", planBadgeClass(currentPlan))}
          >
            {getEntitlements(currentPlan).name}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatUsd(getEntitlements(currentPlan).includedUsageCents)} included
          AI usage each month
          {getEntitlements(currentPlan).allowUsageTopOff
            ? ", then top off with wallet credits."
            : ". Upgrade to Hobby or Pro for more usage and campaigns."}
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

      <section className="grid gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const e = PLAN_ENTITLEMENTS[plan];
          const isCurrent = plan === currentPlan;
          const isPaid = plan === "hobby" || plan === "pro";
          const canSelect =
            isOwner && isPaid && !isCurrent && busyPlan === null;

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
                {formatUsd(e.priceCents)}
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                {featureBullets(plan).map((line) => (
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
                  {isCurrent
                    ? "Current plan"
                    : `Upgrade to ${e.name}`}
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

      <p className="text-xs text-muted-foreground">
        Plans are billed per workspace. Included usage resets monthly and does
        not roll over.{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => router.push("/wallet/transactions")}
        >
          View usage history
        </button>
      </p>
    </div>
  );
}
