import type { AdChannelProvider } from "@/domain";

/** Normalized daily campaign metrics from any ad provider. */
export type NormalizedPerformanceRow = {
  externalCampaignId: string;
  name: string;
  status: string | null;
  channelType: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
};

export type PerformanceFetchContext = {
  connectionId: string;
  workspaceId: string;
  externalAccountId: string;
  currencyCode: string | null;
  /** Opaque provider credentials / client handled by the adapter. */
  credentials: unknown;
};

export type PerformanceFetchResult =
  | { supported: true; rows: NormalizedPerformanceRow[] }
  | { supported: false; reason: string };

export type PerformanceProvider = {
  provider: AdChannelProvider;
  fetchDailyCampaignMetrics(
    ctx: PerformanceFetchContext,
    range: { startDate: string; endDate: string },
  ): Promise<PerformanceFetchResult>;
};
