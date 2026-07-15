import { describe, expect, it } from "vitest";
import {
  AI_MARKUP,
  billedCostCents,
  providerCostUsd,
} from "@/lib/stripe/pricing";
import { getWalletBlockedReason, nextMonthResetIso } from "@/repositories/wallet";
import type { WorkspaceWallet } from "@/domain";

describe("AI pricing", () => {
  it("uses 50% markup constant", () => {
    expect(AI_MARKUP).toBe(1.5);
  });

  it("computes provider cost for gpt-4.1-mini", () => {
    // 1M input @ $0.40 + 1M output @ $1.60 = $2.00
    const usd = providerCostUsd({
      model: "gpt-4.1-mini",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(2.0, 6);
  });

  it("bills at 1.5x and rounds up to cents", () => {
    // 1000 input tokens: 1000/1e6 * 0.4 = 0.0004 USD
    // 500 output: 500/1e6 * 1.6 = 0.0008 USD
    // total 0.0012 * 1.5 = 0.0018 USD → ceil to 1 cent minimum
    const cents = billedCostCents({
      model: "gpt-4.1-mini",
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cents).toBe(1);
  });

  it("returns 0 when no tokens", () => {
    expect(
      billedCostCents({
        model: "gpt-4.1-mini",
        inputTokens: 0,
        outputTokens: 0,
      }),
    ).toBe(0);
  });

  it("scales for larger usage", () => {
    // 500k in + 500k out:
    // 0.5*0.4 + 0.5*1.6 = 0.2 + 0.8 = 1.0 USD * 1.5 = 1.5 USD = 150 cents
    const cents = billedCostCents({
      model: "gpt-4.1-mini",
      inputTokens: 500_000,
      outputTokens: 500_000,
    });
    expect(cents).toBe(150);
  });
});

describe("wallet helpers", () => {
  const base: WorkspaceWallet = {
    workspaceId: "00000000-0000-0000-0000-000000000001",
    stripeCustomerId: null,
    balanceCents: 1000,
    currency: "usd",
    adSpendLimitCents: null,
    usageLimitCents: null,
    usageMtdCents: 0,
    adSpendMtdCents: 0,
    mtdPeriodStart: "2026-07-01",
    autoReloadEnabled: false,
    autoReloadThresholdCents: null,
    autoReloadTargetCents: null,
    stripeDefaultPaymentMethodId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  it("blocks on zero balance", () => {
    expect(getWalletBlockedReason({ ...base, balanceCents: 0 })).toBe(
      "zero_balance",
    );
  });

  it("blocks when usage MTD hits limit", () => {
    expect(
      getWalletBlockedReason({
        ...base,
        usageLimitCents: 500,
        usageMtdCents: 500,
      }),
    ).toBe("usage_limit");
  });

  it("allows when under limits with balance", () => {
    expect(
      getWalletBlockedReason({
        ...base,
        usageLimitCents: 500,
        usageMtdCents: 100,
      }),
    ).toBeNull();
  });

  it("formats next month reset date", () => {
    expect(nextMonthResetIso("2026-07-01")).toBe("Aug 1, 2026");
  });
});
