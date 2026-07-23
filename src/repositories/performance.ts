import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdChannelProvider,
  ExternalCampaign,
  PerformancePoint,
} from "@/domain";
import type { NormalizedPerformanceRow } from "@/lib/performance/types";

type DbExternalCampaign = {
  id: string;
  workspace_id: string;
  connection_id: string;
  provider: AdChannelProvider;
  external_id: string;
  name: string;
  status: string | null;
  channel_type: string | null;
  currency_code: string | null;
  product_id: string | null;
  campaign_id: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function mapExternalCampaign(row: DbExternalCampaign): ExternalCampaign {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    connectionId: row.connection_id,
    provider: row.provider,
    externalId: row.external_id,
    name: row.name ?? "",
    status: row.status,
    channelType: row.channel_type,
    currencyCode: row.currency_code,
    productId: row.product_id,
    campaignId: row.campaign_id,
    lastSyncedAt: row.last_synced_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PerformanceQueryInput = {
  workspaceId: string;
  productId?: string | null;
  provider?: AdChannelProvider | null;
  /** When set, restricts to these providers (takes precedence over `provider`). */
  providers?: AdChannelProvider[] | null;
  /** When set, restricts metrics to these external campaign IDs. */
  campaignIds?: string[] | null;
  connectionId?: string | null;
  startDate: string;
  endDate: string;
  /** Aggregate by calendar day (default) or by provider for bar charts. */
  groupBy?: "date" | "provider" | "campaign";
};

export type PerformanceBreakdownRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
};

export type PerformanceCampaignOption = {
  id: string;
  name: string;
  provider: AdChannelProvider;
  status: string | null;
};

export type PerformanceQueryResult = {
  series: PerformancePoint[];
  breakdown: PerformanceBreakdownRow[];
  totals: Omit<PerformancePoint, "date">;
  campaignCount: number;
  /** All campaigns for the product/connection scope (before campaignIds filter). */
  campaigns: PerformanceCampaignOption[];
};

function emptyTotals(): Omit<PerformancePoint, "date"> {
  return {
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    revenue: 0,
  };
}

function addMetrics(
  a: Omit<PerformancePoint, "date">,
  b: Omit<PerformancePoint, "date">,
): Omit<PerformancePoint, "date"> {
  return {
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    spend: a.spend + b.spend,
    conversions: a.conversions + b.conversions,
    revenue: a.revenue + b.revenue,
  };
}

export class SupabasePerformanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listExternalCampaigns(
    workspaceId: string,
    opts: {
      productId?: string | null;
      provider?: AdChannelProvider | null;
      connectionId?: string | null;
    } = {},
  ): Promise<ExternalCampaign[]> {
    let query = this.client
      .from("external_campaigns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });
    if (opts.productId) query = query.eq("product_id", opts.productId);
    if (opts.provider) query = query.eq("provider", opts.provider);
    if (opts.connectionId) query = query.eq("connection_id", opts.connectionId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbExternalCampaign[]).map(mapExternalCampaign);
  }

  /** Upsert a single external campaign with optional product/campaign links. */
  async upsertLinkedExternalCampaign(input: {
    workspaceId: string;
    connectionId: string;
    provider: AdChannelProvider;
    externalId: string;
    name: string;
    status: string | null;
    channelType: string | null;
    currencyCode: string | null;
    productId?: string | null;
    campaignId?: string | null;
  }): Promise<ExternalCampaign> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("external_campaigns")
      .upsert(
        {
          workspace_id: input.workspaceId,
          connection_id: input.connectionId,
          provider: input.provider,
          external_id: input.externalId,
          name: input.name,
          status: input.status,
          channel_type: input.channelType,
          currency_code: input.currencyCode,
          product_id: input.productId ?? null,
          campaign_id: input.campaignId ?? null,
          last_synced_at: now,
          updated_at: now,
        },
        { onConflict: "connection_id,external_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return mapExternalCampaign(data as DbExternalCampaign);
  }

  /**
   * Upsert mirrored campaigns and daily points from a provider sync.
   * Groups rows by external campaign id, upserts campaigns, then points.
   */
  async upsertSyncRows(input: {
    workspaceId: string;
    connectionId: string;
    provider: AdChannelProvider;
    currencyCode: string | null;
    rows: NormalizedPerformanceRow[];
    syncedAt?: string;
  }): Promise<{ campaignCount: number; pointCount: number }> {
    if (input.rows.length === 0) {
      return { campaignCount: 0, pointCount: 0 };
    }

    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const byCampaign = new Map<string, NormalizedPerformanceRow[]>();
    for (const row of input.rows) {
      const list = byCampaign.get(row.externalCampaignId) ?? [];
      list.push(row);
      byCampaign.set(row.externalCampaignId, list);
    }

    const campaignUpserts = [...byCampaign.entries()].map(
      ([externalId, rows]) => {
        const latest = rows[rows.length - 1]!;
        return {
          workspace_id: input.workspaceId,
          connection_id: input.connectionId,
          provider: input.provider,
          external_id: externalId,
          name: latest.name,
          status: latest.status,
          channel_type: latest.channelType,
          currency_code: input.currencyCode,
          last_synced_at: syncedAt,
          updated_at: syncedAt,
        };
      },
    );

    const { data: upserted, error: campaignError } = await this.client
      .from("external_campaigns")
      .upsert(campaignUpserts, { onConflict: "connection_id,external_id" })
      .select("id, external_id");
    if (campaignError) throw campaignError;

    const idByExternal = new Map<string, string>();
    for (const row of upserted ?? []) {
      idByExternal.set(String(row.external_id), String(row.id));
    }

    const points = input.rows
      .map((row) => {
        const externalCampaignId = idByExternal.get(row.externalCampaignId);
        if (!externalCampaignId) return null;
        return {
          external_campaign_id: externalCampaignId,
          date: row.date,
          impressions: Math.round(row.impressions),
          clicks: Math.round(row.clicks),
          spend: row.spend,
          conversions: row.conversions,
          revenue: row.revenue,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (points.length > 0) {
      const { error: pointsError } = await this.client
        .from("campaign_performance_points")
        .upsert(points, { onConflict: "external_campaign_id,date" });
      if (pointsError) throw pointsError;
    }

    return {
      campaignCount: campaignUpserts.length,
      pointCount: points.length,
    };
  }

  async queryPerformance(
    input: PerformanceQueryInput,
  ): Promise<PerformanceQueryResult> {
    const allCampaigns = await this.listExternalCampaigns(input.workspaceId, {
      productId: input.productId,
      connectionId: input.connectionId,
    });

    const campaignOptions: PerformanceCampaignOption[] = allCampaigns.map(
      (c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        status: c.status,
      }),
    );

    const providerFilter =
      input.providers && input.providers.length > 0
        ? new Set(input.providers)
        : input.provider
          ? new Set([input.provider])
          : null;

    let campaigns = providerFilter
      ? allCampaigns.filter((c) => providerFilter.has(c.provider))
      : allCampaigns;

    const campaignIdFilter =
      input.campaignIds && input.campaignIds.length > 0
        ? new Set(input.campaignIds)
        : null;

    if (campaignIdFilter) {
      campaigns = campaigns.filter((c) => campaignIdFilter.has(c.id));
    }

    if (campaigns.length === 0) {
      return {
        series: [],
        breakdown: [],
        totals: emptyTotals(),
        campaignCount: 0,
        campaigns: campaignOptions,
      };
    }

    const campaignIds = campaigns.map((c) => c.id);
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));

    const { data, error } = await this.client
      .from("campaign_performance_points")
      .select(
        "external_campaign_id, date, impressions, clicks, spend, conversions, revenue",
      )
      .in("external_campaign_id", campaignIds)
      .gte("date", input.startDate)
      .lte("date", input.endDate)
      .order("date", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as {
      external_campaign_id: string;
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
      revenue: number;
    }[];

    const byDate = new Map<string, Omit<PerformancePoint, "date">>();
    const byKey = new Map<
      string,
      { label: string; metrics: Omit<PerformancePoint, "date"> }
    >();
    let totals = emptyTotals();

    const groupBy = input.groupBy ?? "date";

    for (const row of rows) {
      const metrics = {
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        spend: Number(row.spend ?? 0),
        conversions: Number(row.conversions ?? 0),
        revenue: Number(row.revenue ?? 0),
      };
      totals = addMetrics(totals, metrics);

      const dateKey = String(row.date);
      byDate.set(dateKey, addMetrics(byDate.get(dateKey) ?? emptyTotals(), metrics));

      const campaign = campaignById.get(row.external_campaign_id);
      let key: string;
      let label: string;
      if (groupBy === "provider") {
        key = campaign?.provider ?? "unknown";
        label = key;
      } else if (groupBy === "campaign") {
        key = row.external_campaign_id;
        label = campaign?.name ?? key;
      } else {
        key = dateKey;
        label = dateKey;
      }
      const existing = byKey.get(key);
      byKey.set(key, {
        label,
        metrics: addMetrics(existing?.metrics ?? emptyTotals(), metrics),
      });
    }

    const series: PerformancePoint[] = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, m]) => ({ date, ...m }));

    const breakdown: PerformanceBreakdownRow[] = [...byKey.entries()].map(
      ([key, { label, metrics }]) => ({
        key,
        label,
        ...metrics,
      }),
    );

    return {
      series,
      breakdown,
      totals,
      campaignCount: campaigns.length,
      campaigns: campaignOptions,
    };
  }

  async getProductPerformance(
    productId: string,
  ): Promise<PerformancePoint[]> {
    const { data: campaigns, error: campaignError } = await this.client
      .from("external_campaigns")
      .select("id")
      .eq("product_id", productId);
    if (campaignError) throw campaignError;
    const ids = (campaigns ?? []).map((c) => String(c.id));
    if (ids.length === 0) return [];

    const { data, error } = await this.client
      .from("campaign_performance_points")
      .select("date, impressions, clicks, spend, conversions, revenue")
      .in("external_campaign_id", ids)
      .order("date", { ascending: true });
    if (error) throw error;

    const byDate = new Map<string, Omit<PerformancePoint, "date">>();
    for (const row of data ?? []) {
      const date = String(row.date);
      byDate.set(
        date,
        addMetrics(byDate.get(date) ?? emptyTotals(), {
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          spend: Number(row.spend ?? 0),
          conversions: Number(row.conversions ?? 0),
          revenue: Number(row.revenue ?? 0),
        }),
      );
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, m]) => ({ date, ...m }));
  }
}
