import type { WorkspacePlan } from "@/domain";

/** Hobby / Free default markup (50% margin on provider cost). */
export const HOBBY_AI_MARKUP = 1.5;

/** Pro markup: pass-through (1.0×) → ~1.5× tokens per dollar vs Hobby. */
export const PRO_AI_MARKUP = 1.0;

/** Annual discount vs monthly list price (20% off). */
export const ANNUAL_DISCOUNT = 0.2;

export type BillingInterval = "month" | "year";

export type PlanEntitlements = {
  plan: WorkspacePlan;
  /** Display name */
  name: string;
  /** Monthly per-seat subscription price in cents (0 for Free). */
  priceCentsPerSeatMonthly: number;
  /** Included AI usage allotment per seat per calendar month (UTC), in cents. */
  includedUsageCentsPerSeat: number;
  /**
   * Included AI actions per workspace per month (Free).
   * Paid plans are dollar-gated; actions are still metered for display.
   * null = no action hard-cap.
   */
  includedActions: number | null;
  /** Markup applied on provider cost when billing AI. */
  aiMarkup: number;
  /** Badge / marketing accent. */
  badgeColor: "yellow" | "blue" | "green";
  /** Insights feature unlocked. */
  hasInsights: boolean;
  /** Max saved campaigns per product; null = unlimited. */
  maxCampaignsPerProduct: number | null;
  /** Max creatives (ad_copy) per campaign; null = unlimited; 0 = none. */
  maxCreativesPerCampaign: number | null;
  /** Can add ad spend / launch campaigns. */
  canSpendAndLaunch: boolean;
  /** After included allotment is used, may top off via wallet purchases. */
  allowUsageTopOff: boolean;
  /** Unused included usage rolls into the next month (capped at 1× monthly allotment). */
  allowIncludedRollover: boolean;
};

export const PLAN_ENTITLEMENTS: Record<WorkspacePlan, PlanEntitlements> = {
  free: {
    plan: "free",
    name: "Free",
    priceCentsPerSeatMonthly: 0,
    includedUsageCentsPerSeat: 150, // $1.50
    includedActions: 100,
    aiMarkup: HOBBY_AI_MARKUP,
    badgeColor: "yellow",
    hasInsights: false,
    maxCampaignsPerProduct: 0,
    maxCreativesPerCampaign: 0,
    canSpendAndLaunch: false,
    allowUsageTopOff: true,
    allowIncludedRollover: true,
  },
  hobby: {
    plan: "hobby",
    name: "Hobby",
    priceCentsPerSeatMonthly: 900, // $9 / seat / mo
    includedUsageCentsPerSeat: 900,
    includedActions: null,
    aiMarkup: HOBBY_AI_MARKUP,
    badgeColor: "blue",
    hasInsights: false,
    maxCampaignsPerProduct: 10,
    maxCreativesPerCampaign: 3,
    canSpendAndLaunch: true,
    allowUsageTopOff: true,
    allowIncludedRollover: true,
  },
  pro: {
    plan: "pro",
    name: "Pro",
    priceCentsPerSeatMonthly: 9900, // $99 / seat / mo
    includedUsageCentsPerSeat: 9900,
    includedActions: null,
    aiMarkup: PRO_AI_MARKUP,
    badgeColor: "green",
    hasInsights: true,
    maxCampaignsPerProduct: null,
    maxCreativesPerCampaign: null,
    canSpendAndLaunch: true,
    allowUsageTopOff: true,
    allowIncludedRollover: true,
  },
};

/** @deprecated Use priceCentsPerSeatMonthly — kept for gradual call-site updates. */
export type LegacyPlanFields = {
  priceCents: number;
  includedUsageCents: number;
};

export function getEntitlements(plan: WorkspacePlan): PlanEntitlements & LegacyPlanFields {
  const base = PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
  return {
    ...base,
    priceCents: base.priceCentsPerSeatMonthly,
    includedUsageCents: base.includedUsageCentsPerSeat,
  };
}

export function planDisplayName(plan: WorkspacePlan): string {
  return getEntitlements(plan).name;
}

/** Paid plans offered via Stripe Checkout (subscription). */
export const PAID_PLANS = ["hobby", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: WorkspacePlan): plan is PaidPlan {
  return plan === "hobby" || plan === "pro";
}

export function canUpgradePlan(plan: WorkspacePlan): boolean {
  return plan !== "pro";
}

/** Next plan on the upgrade ladder, if any. */
export function nextUpgradePlan(plan: WorkspacePlan): PaidPlan | null {
  if (plan === "free") return "hobby";
  if (plan === "hobby") return "pro";
  return null;
}

export function clampSeatCount(seats: number): number {
  if (!Number.isFinite(seats) || seats < 1) return 1;
  return Math.min(Math.floor(seats), 500);
}

/** Monthly included usage for a workspace given seat count. */
export function includedUsageCentsForSeats(
  plan: WorkspacePlan,
  seats: number,
): number {
  const e = getEntitlements(plan);
  return e.includedUsageCentsPerSeat * clampSeatCount(seats);
}

/** List price for one seat at the given interval (cents charged per billing period). */
export function priceCentsPerSeat(
  plan: WorkspacePlan,
  interval: BillingInterval,
): number {
  const monthly = getEntitlements(plan).priceCentsPerSeatMonthly;
  if (monthly <= 0) return 0;
  if (interval === "month") return monthly;
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
}

/** Effective monthly cost per seat when paying annually (for display). */
export function effectiveMonthlyCentsPerSeat(plan: WorkspacePlan): number {
  const annual = priceCentsPerSeat(plan, "year");
  return Math.round(annual / 12);
}

export function formatUsd(cents: number): string {
  if (cents === 0) return "$0";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function featureBullets(
  plan: WorkspacePlan,
  opts: { seats?: number } = {},
): string[] {
  const e = getEntitlements(plan);
  const seats = clampSeatCount(opts.seats ?? 1);
  const included = includedUsageCentsForSeats(plan, seats);
  const bullets: string[] = [];

  if (e.includedActions != null) {
    bullets.push(`${e.includedActions} AI actions included / mo`);
  }
  bullets.push(
    seats > 1
      ? `${formatUsd(included)} AI usage included / mo (${seats} seats)`
      : `${formatUsd(e.includedUsageCentsPerSeat)} AI usage included / mo per seat`,
  );

  if (e.allowUsageTopOff) {
    bullets.push("Top off credits anytime");
  }
  if (e.allowIncludedRollover) {
    bullets.push("Unused included usage rolls over (1 mo cap)");
  }

  if (e.maxCampaignsPerProduct === null) {
    bullets.push("Unlimited campaigns per product");
  } else if (e.maxCampaignsPerProduct === 0) {
    bullets.push("Campaign concepts only (no launch)");
  } else {
    bullets.push(`Up to ${e.maxCampaignsPerProduct} campaigns per product`);
  }

  if (e.maxCreativesPerCampaign === null) {
    bullets.push("Unlimited creatives per campaign");
  } else if (e.maxCreativesPerCampaign === 0) {
    bullets.push("Creatives locked");
  } else {
    bullets.push(`Up to ${e.maxCreativesPerCampaign} creatives per campaign`);
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
    bullets.push("1.0× AI rates (pass-through, ~1.5× tokens/$ vs Hobby)");
  }

  if (plan !== "free") {
    bullets.push("Billed per seat");
  }

  return bullets;
}
