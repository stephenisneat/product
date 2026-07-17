import { describe, expect, it } from "vitest";
import {
  AI_MARKUP,
  billedCostCents,
  providerCostUsd,
} from "@/lib/stripe/pricing";
import {
  getWalletBlockedReason,
  nextMonthResetIso,
} from "@/repositories/wallet";
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

  it("accepts AI Gateway provider/model ids", () => {
    const usd = providerCostUsd({
      model: "openai/gpt-4.1-mini",
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

  it("respects custom markup (Pro 1.25x)", () => {
    const cents = billedCostCents({
      model: "gpt-4.1-mini",
      inputTokens: 500_000,
      outputTokens: 500_000,
      markup: 1.25,
    });
    // 1.0 USD * 1.25 = 1.25 USD = 125 cents
    expect(cents).toBe(125);
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

  it("allows Free with zero balance while included allotment remains", () => {
    expect(
      getWalletBlockedReason({ ...base, balanceCents: 0 }, "free"),
    ).toBeNull();
  });

  it("blocks Free when included allotment is exhausted", () => {
    expect(
      getWalletBlockedReason(
        { ...base, balanceCents: 500, usageMtdCents: 150 },
        "free",
      ),
    ).toBe("usage_limit");
  });

  it("blocks Hobby on zero balance after allotment", () => {
    expect(
      getWalletBlockedReason(
        { ...base, balanceCents: 0, usageMtdCents: 900 },
        "hobby",
      ),
    ).toBe("zero_balance");
  });

  it("allows Hobby with balance after allotment", () => {
    expect(
      getWalletBlockedReason(
        { ...base, balanceCents: 100, usageMtdCents: 900 },
        "hobby",
      ),
    ).toBeNull();
  });

  it("blocks when custom usage MTD hits limit", () => {
    expect(
      getWalletBlockedReason(
        {
          ...base,
          usageLimitCents: 500,
          usageMtdCents: 500,
        },
        "pro",
      ),
    ).toBe("usage_limit");
  });

  it("formats next month reset date", () => {
    expect(nextMonthResetIso("2026-07-01")).toBe("Aug 1, 2026");
  });
});
