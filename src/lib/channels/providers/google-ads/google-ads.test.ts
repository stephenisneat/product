import { describe, expect, it } from "vitest";
import {
  formatCustomerId,
  normalizeCustomerId,
} from "@/lib/channels/providers/google-ads/format";
import {
  BIDDING_STRATEGIES,
  CAMPAIGN_STATUS,
  CHANNEL_TYPES,
  customerResourceName,
  hasGoogleAdsConfig,
  microsFromAmount,
  amountFromMicros,
} from "@/lib/channels/providers/google-ads";
import { adConnectionSchema, googleAdsChannelTypeSchema } from "@/domain";

describe("google ads format helpers", () => {
  it("normalizes and formats customer ids", () => {
    expect(normalizeCustomerId("123-456-7890")).toBe("1234567890");
    expect(formatCustomerId("1234567890")).toBe("123-456-7890");
    expect(customerResourceName("123-456-7890")).toBe("customers/1234567890");
  });

  it("rejects invalid customer ids", () => {
    expect(() => normalizeCustomerId("abc")).toThrow(/valid Google Ads/);
  });
});

describe("google ads money helpers", () => {
  it("converts currency amounts to/from micros", () => {
    expect(microsFromAmount(50)).toBe("50000000");
    expect(amountFromMicros("50000000")).toBe(50);
    expect(amountFromMicros(undefined)).toBeUndefined();
  });
});

describe("google ads constants", () => {
  it("exposes Search, Display, and YouTube channel types", () => {
    expect(CHANNEL_TYPES.SEARCH).toBe("SEARCH");
    expect(CHANNEL_TYPES.DISPLAY).toBe("DISPLAY");
    expect(CHANNEL_TYPES.VIDEO).toBe("VIDEO");
    expect(googleAdsChannelTypeSchema.parse("VIDEO")).toBe("VIDEO");
    expect(CAMPAIGN_STATUS.PAUSED).toBe("PAUSED");
    expect(BIDDING_STRATEGIES.MAXIMIZE_CLICKS).toBe("MAXIMIZE_CLICKS");
  });
});

describe("google ads config", () => {
  it("reports missing config without throwing", () => {
    expect(hasGoogleAdsConfig()).toBe(false);
  });
});

describe("adConnectionSchema", () => {
  it("accepts a linked Google Ads connection", () => {
    const parsed = adConnectionSchema.parse({
      id: "adconn_abc",
      workspaceId: "00000000-0000-0000-0000-000000000001",
      provider: "google",
      externalAccountId: "1234567890",
      loginCustomerId: null,
      accountName: "Acme Ads",
      currencyCode: "USD",
      timeZone: "America/New_York",
      isManager: false,
      scope: "https://www.googleapis.com/auth/adwords",
      status: "active",
      connectedBy: "user_1",
      metadata: { channels: ["SEARCH", "DISPLAY", "VIDEO"] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.provider).toBe("google");
    expect(parsed.externalAccountId).toBe("1234567890");
  });

  it("accepts a pending OAuth credential row", () => {
    const parsed = adConnectionSchema.parse({
      id: "adconn_pending",
      workspaceId: "00000000-0000-0000-0000-000000000001",
      provider: "google",
      externalAccountId: null,
      accountName: "",
      isManager: false,
      scope: "",
      status: "pending",
      metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.status).toBe("pending");
  });
});
