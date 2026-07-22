import type {
  PerformanceFetchContext,
  PerformanceFetchResult,
  PerformanceProvider,
} from "@/lib/performance/types";

function stubProvider(
  provider: PerformanceProvider["provider"],
  label: string,
): PerformanceProvider {
  return {
    provider,
    async fetchDailyCampaignMetrics(
      _ctx: PerformanceFetchContext,
      _range: { startDate: string; endDate: string },
    ): Promise<PerformanceFetchResult> {
      return {
        supported: false,
        reason: `${label} performance sync is not implemented yet.`,
      };
    },
  };
}

export const metaPerformanceProvider = stubProvider("meta", "Meta");
export const tiktokPerformanceProvider = stubProvider("tiktok", "TikTok");
export const amazonPerformanceProvider = stubProvider("amazon", "Amazon Ads");
export const xPerformanceProvider = stubProvider("x", "X Ads");
