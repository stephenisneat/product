import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { WorkspacePlan } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingChrome } from "@/features/marketing/marketing-chrome";
import {
  ANNUAL_DISCOUNT,
  PLAN_ENTITLEMENTS,
  effectiveMonthlyCentsPerSeat,
  featureBullets,
  formatUsd,
  getEntitlements,
} from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

function planBadgeClass(plan: WorkspacePlan) {
  const color = getEntitlements(plan).badgeColor;
  if (color === "green") {
    return "border-green-500/30 bg-green-500/40 text-green-100 font-semibold";
  }
  if (color === "blue") {
    return "border-blue-500/30 bg-blue-500/40 text-blue-100 font-semibold";
  }
  return "border-yellow-500/30 bg-yellow-500/40 text-yellow-100 font-semibold";
}

const PLAN_ORDER: WorkspacePlan[] = ["free", "hobby", "pro"];

export function MarketingPricingPage() {
  return (
    <MarketingChrome>
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-10">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="font-heading max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:leading-[1.08]">
          Simple plans for every team
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Per-seat pricing with included AI usage, monthly rollover, and annual
          billing at {Math.round(ANNUAL_DISCOUNT * 100)}% off. Start free — top
          off anytime.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const e = PLAN_ENTITLEMENTS[plan];
            const monthly = e.priceCentsPerSeatMonthly;
            const annualEffective = effectiveMonthlyCentsPerSeat(plan);
            const highlighted = plan === "pro";

            return (
              <div
                key={plan}
                className={cn(
                  "flex flex-col rounded-xl border border-border/80 bg-background/40 p-5 backdrop-blur-sm",
                  highlighted && "border-foreground/35 bg-background/60",
                )}
              >
                <Badge
                  variant="secondary"
                  className={cn(
                    "mb-3 h-5 w-fit px-1.5 text-[11px]",
                    planBadgeClass(plan),
                  )}
                >
                  {e.name}
                </Badge>
                <p className="font-heading text-3xl font-semibold tracking-tight">
                  {formatUsd(monthly)}
                  <span className="text-base font-normal text-muted-foreground">
                    {monthly === 0 ? "" : "/seat/mo"}
                  </span>
                </p>
                {monthly > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    or {formatUsd(annualEffective)}/seat/mo billed annually
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    100 AI actions / mo · top off when you need more
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                  {featureBullets(plan).map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-foreground/70" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={highlighted ? "default" : "outline"}
                  size="sm"
                  render={<Link href="/signup" />}
                >
                  {plan === "free" ? "Get started free" : `Start with ${e.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Pro includes pass-through AI rates (1.0×) — about 1.5× the tokens per
          dollar versus Hobby. Unused included usage rolls over up to one month
          of allotment.
        </p>
      </main>
    </MarketingChrome>
  );
}
