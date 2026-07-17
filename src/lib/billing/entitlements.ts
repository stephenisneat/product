import type { WorkspacePlan } from "@/domain";

/** Hobby / Free default markup (50% margin on provider cost). */
export const HOBBY_AI_MARKUP = 1.5;

/** Pro markup: half the Hobby margin (25%) → 1.25×. */
export const PRO_AI_MARKUP = 1.25;

export type PlanEntitlements = {
  plan: WorkspacePlan;
  /** Display name */
  name: string;
  /** Monthly subscription price in cents (0 for Free). */
  priceCents: number;
  /** Included AI usage allotment per calendar month (UTC), in cents. */
  includedUsageCents: number;
  /** Markup applied on provider cost when billing AI. */
  aiMarkup: number;
  /** Badge / marketing accent. */
  badgeColor: "yellow" | "blue" | "green";
  /** Insights feature unlocked. */
  hasInsights: boolean;
  /** Max saved campaigns per product; null = unlimited. */
  maxCampaignsPerProduct: number | null;
  /** Can add ad spend / launch campaigns. */
  canSpendAndLaunch: boolean;
  /** After included allotment is used, may top off via wallet purchases. */
  allowUsageTopOff: boolean;
};

export const PLAN_ENTITLEMENTS: Record<WorkspacePlan, PlanEntitlements> = {
  free: {
    plan: "free",
    name: "Free",
    priceCents: 0,
    includedUsageCents: 150, // $1.50
    aiMarkup: HOBBY_AI_MARKUP,
    badgeColor: "yellow",
    hasInsights: false,
    maxCampaignsPerProduct: 0,
    canSpendAndLaunch: false,
    allowUsageTopOff: false,
  },
  hobby: {
    plan: "hobby",
    name: "Hobby",
    priceCents: 900, // $9
    includedUsageCents: 900,
    aiMarkup: HOBBY_AI_MARKUP,
    badgeColor: "blue",
    hasInsights: false,
    maxCampaignsPerProduct: 10,
    canSpendAndLaunch: true,
    allowUsageTopOff: true,
  },
  pro: {
    plan: "pro",
    name: "Pro",
    priceCents: 9900, // $99
    includedUsageCents: 9900,
    aiMarkup: PRO_AI_MARKUP,
    badgeColor: "green",
    hasInsights: true,
    maxCampaignsPerProduct: null,
    canSpendAndLaunch: true,
    allowUsageTopOff: true,
  },
};

export function getEntitlements(plan: WorkspacePlan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
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
