import type { GoogleAdsClient } from "@/lib/channels/providers/google-ads";
import type {
  PerformanceFetchContext,
  PerformanceFetchResult,
  PerformanceProvider,
} from "@/lib/performance/types";

export const googlePerformanceProvider: PerformanceProvider = {
  provider: "google",
  async fetchDailyCampaignMetrics(
    ctx: PerformanceFetchContext,
    range: { startDate: string; endDate: string },
  ): Promise<PerformanceFetchResult> {
    const client = ctx.credentials as GoogleAdsClient;
    const rows = await client.getCampaignPerformanceDaily(range);
    return {
      supported: true,
      rows: rows
        .filter((row) => row.date && row.campaignId)
        .map((row) => ({
          externalCampaignId: row.campaignId,
          name: row.campaignName,
          status: row.campaignStatus || null,
          channelType: row.channelType || null,
          date: row.date,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.cost,
          conversions: row.conversions,
          revenue: row.conversionsValue,
        })),
    };
  },
};
