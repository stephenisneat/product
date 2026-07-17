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
    const cents = billedCostCents({
      model: "gpt-4.1-mini",
      inputTokens: 500_000,
      outputTokens: 500_000,
    });
    expect(cents).toBe(150);
  });

  it("respects Pro 1.0x pass-through markup", () => {
    const cents = billedCostCents({
      model: "gpt-4.1-mini",
      inputTokens: 500_000,
      outputTokens: 500_000,
      markup: 1.0,
    });
    expect(cents).toBe(100);
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
    actionsMtd: 0,
    includedRolloverCents: 0,
    mtdPeriodStart: "2026-07-01",
    autoReloadEnabled: false,
    autoReloadThresholdCents: null,
    autoReloadTargetCents: null,
    stripeDefaultPaymentMethodId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  it("allows Free with zero balance while included actions remain", () => {
    expect(
      getWalletBlockedReason({ ...base, balanceCents: 0 }, "free"),
    ).toBeNull();
  });

  it("blocks Free when actions exhausted and no top-off balance", () => {
    expect(
      getWalletBlockedReason(
        { ...base, balanceCents: 0, actionsMtd: 100, usageMtdCents: 50 },
        "free",
      ),
    ).toBe("zero_balance");
  });

  it("allows Free top-off after action cap when balance remains", () => {
    expect(
      getWalletBlockedReason(
        { ...base, balanceCents: 200, actionsMtd: 100, usageMtdCents: 200 },
        "free",
      ),
    ).toBeNull();
  });

  it("counts rollover toward included allotment", () => {
    expect(
      getWalletBlockedReason(
        {
          ...base,
          balanceCents: 0,
          usageMtdCents: 200,
          includedRolloverCents: 100,
        },
        "free",
      ),
    ).toBeNull();
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
