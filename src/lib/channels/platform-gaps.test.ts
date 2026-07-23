import { describe, expect, it } from "vitest";
import { normalizeChannelProvider } from "@/lib/channels/launch-campaign";
import { getPerformanceProvider } from "@/lib/performance/providers";

describe("platform gap closures", () => {
  it("registers real performance providers for all ad channels", () => {
    for (const provider of ["google", "meta", "tiktok", "amazon", "x"] as const) {
      const adapter = getPerformanceProvider(provider);
      expect(adapter.provider).toBe(provider);
      expect(typeof adapter.fetchDailyCampaignMetrics).toBe("function");
    }
  });

  it("normalizes channel aliases for launch targeting", () => {
    expect(normalizeChannelProvider("Google Ads")).toBe("google");
    expect(normalizeChannelProvider("facebook")).toBe("meta");
    expect(normalizeChannelProvider("twitter")).toBe("x");
    expect(normalizeChannelProvider("amazon_ads")).toBe("amazon");
    expect(normalizeChannelProvider("unknown")).toBeNull();
  });
});
