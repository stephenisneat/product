import { getXAdsConfig, refreshXAdsAccessToken } from "./oauth";

export type XAdsAccount = {
  accountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
};

export type XAdsClientCredentials = {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  onTokenRefresh?: (tokens: {
    accessToken: string;
    expiresAt: string;
    refreshToken?: string;
  }) => Promise<void> | void;
};

export class XAdsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "XAdsApiError";
  }
}

async function parseError(response: Response): Promise<XAdsApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => undefined);
  }
  const message =
    typeof body === "object" &&
    body &&
    "detail" in body &&
    typeof (body as { detail?: string }).detail === "string"
      ? (body as { detail: string }).detail
      : typeof body === "object" &&
          body &&
          "errors" in body &&
          Array.isArray((body as { errors?: { message?: string }[] }).errors)
        ? (body as { errors: { message?: string }[] }).errors[0]?.message ||
          `X Ads API HTTP ${response.status}`
        : `X Ads API HTTP ${response.status}`;
  return new XAdsApiError(message, response.status, body);
}

export class XAdsClient {
  private accessToken: string;
  private refreshToken: string;

  constructor(private readonly creds: XAdsClientCredentials) {
    this.accessToken = creds.accessToken;
    this.refreshToken = creds.refreshToken;
  }

  private baseUrl(): string {
    const { apiVersion } = getXAdsConfig();
    return `https://ads-api.x.com/${apiVersion}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryOnAuth?: boolean } = {},
  ): Promise<T> {
    const { retryOnAuth = true, ...fetchInit } = init;
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...fetchInit,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(fetchInit.headers as Record<string, string> | undefined),
      },
    });

    if ((response.status === 401 || response.status === 403) && retryOnAuth) {
      await this.refreshAccessToken();
      return this.request<T>(path, { ...init, retryOnAuth: false });
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    return (await response.json()) as T;
  }

  private async refreshAccessToken(): Promise<void> {
    const tokens = await refreshXAdsAccessToken(this.refreshToken);
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000,
    ).toISOString();
    await this.creds.onTokenRefresh?.({
      accessToken: tokens.accessToken,
      expiresAt,
      refreshToken: tokens.refreshToken,
    });
  }

  /** List ad accounts accessible with this OAuth credential. */
  static async listAccounts(accessToken: string): Promise<XAdsAccount[]> {
    const config = getXAdsConfig();
    const response = await fetch(
      `https://ads-api.x.com/${config.apiVersion}/accounts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = (await response.json()) as {
      data?: {
        id?: string;
        name?: string;
        currency?: string;
        timezone?: string;
      }[];
    };

    return (body.data ?? []).map((row) => ({
      accountId: String(row.id ?? ""),
      name: row.name ?? `Account ${row.id ?? ""}`,
      currencyCode: row.currency ?? null,
      timeZone: row.timezone ?? null,
    }));
  }

  private accountId(): string {
    const id = this.creds.accountId;
    if (!id) throw new Error("X Ads client has no account selected.");
    return id;
  }

  async getAccount(accountId: string): Promise<XAdsAccount> {
    const body = await this.request<{
      data?: {
        id?: string;
        name?: string;
        currency?: string;
        timezone?: string;
      };
    }>(`/accounts/${encodeURIComponent(accountId)}`);

    const row = body.data;
    if (!row?.id) {
      throw new XAdsApiError("Account not found", 404);
    }
    return {
      accountId: String(row.id),
      name: row.name ?? `Account ${row.id}`,
      currencyCode: row.currency ?? null,
      timeZone: row.timezone ?? null,
    };
  }

  async listCampaigns(): Promise<XAdsCampaign[]> {
    const body = await this.request<{
      data?: {
        id?: string;
        name?: string;
        entity_status?: string;
        daily_budget_amount_local_micro?: number;
      }[];
    }>(`/accounts/${encodeURIComponent(this.accountId())}/campaigns?count=200`);

    return (body.data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: row.name ?? `Campaign ${row.id ?? ""}`,
      status: row.entity_status ?? "UNKNOWN",
      objective: null,
      dailyBudget:
        row.daily_budget_amount_local_micro != null
          ? Number(row.daily_budget_amount_local_micro) / 1_000_000
          : null,
    }));
  }

  async createCampaign(input: {
    name: string;
    dailyBudget: number;
    status?: "ACTIVE" | "PAUSED" | "DRAFT";
  }): Promise<{ id: string }> {
    const params = new URLSearchParams({
      name: input.name,
      funding_instrument_id: await this.defaultFundingInstrumentId(),
      entity_status: input.status ?? "PAUSED",
      daily_budget_amount_local_micro: String(
        Math.round(input.dailyBudget * 1_000_000),
      ),
    });
    const body = await this.request<{ data?: { id?: string } }>(
      `/accounts/${encodeURIComponent(this.accountId())}/campaigns?${params.toString()}`,
      { method: "POST" },
    );
    if (!body.data?.id) {
      throw new XAdsApiError("X Ads campaign create returned no id", 502, body);
    }
    return { id: body.data.id };
  }

  async updateCampaignStatus(
    campaignId: string,
    status: "ACTIVE" | "PAUSED",
  ): Promise<void> {
    const params = new URLSearchParams({ entity_status: status });
    await this.request(
      `/accounts/${encodeURIComponent(this.accountId())}/campaigns/${encodeURIComponent(campaignId)}?${params.toString()}`,
      { method: "PUT" },
    );
  }

  private async defaultFundingInstrumentId(): Promise<string> {
    const body = await this.request<{
      data?: { id?: string; entity_status?: string }[];
    }>(
      `/accounts/${encodeURIComponent(this.accountId())}/funding_instruments?count=20`,
    );
    const active =
      body.data?.find((row) => row.entity_status === "ACTIVE") ?? body.data?.[0];
    if (!active?.id) {
      throw new XAdsApiError("No X Ads funding instrument available", 400, body);
    }
    return active.id;
  }

  async getCampaignPerformanceDaily(opts: {
    startDate: string;
    endDate: string;
  }): Promise<XAdsCampaignPerformanceDaily[]> {
    const campaigns = await this.listCampaigns();
    if (campaigns.length === 0) return [];

    const start = `${opts.startDate}T00:00:00Z`;
    const end = `${opts.endDate}T23:59:59Z`;
    const entityIds = campaigns.map((c) => c.id).join(",");
    const params = new URLSearchParams({
      entity: "CAMPAIGN",
      entity_ids: entityIds,
      start_time: start,
      end_time: end,
      granularity: "DAY",
      metric_groups: "ENGAGEMENT,BILLING,WEB_CONVERSION",
      placement: "ALL_ON_TWITTER",
    });

    const body = await this.request<{
      data?: {
        id?: string;
        id_data?: {
          segment?: { segment_name?: string; segment_value?: string };
          metrics?: {
            impressions?: number[];
            clicks?: number[];
            billed_charge_local_micro?: number[];
            conversion_purchases?: number[];
            conversion_purchases_value_micros_usd?: number[];
          };
        }[];
      }[];
    }>(
      `/stats/accounts/${encodeURIComponent(this.accountId())}?${params.toString()}`,
    );

    const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
    const rows: XAdsCampaignPerformanceDaily[] = [];

    for (const entry of body.data ?? []) {
      const campaignId = String(entry.id ?? "");
      if (!campaignId) continue;
      for (const slice of entry.id_data ?? []) {
        const metrics = slice.metrics;
        if (!metrics) continue;
        const dates = expandUtcDates(opts.startDate, opts.endDate);
        const len = Math.max(
          metrics.impressions?.length ?? 0,
          metrics.clicks?.length ?? 0,
          metrics.billed_charge_local_micro?.length ?? 0,
          dates.length,
        );
        for (let i = 0; i < len; i++) {
          const date = dates[i];
          if (!date) continue;
          rows.push({
            date,
            campaignId,
            campaignName: nameById.get(campaignId) ?? `Campaign ${campaignId}`,
            campaignStatus: "ACTIVE",
            channelType: "X",
            impressions: Number(metrics.impressions?.[i] ?? 0),
            clicks: Number(metrics.clicks?.[i] ?? 0),
            spend: Number(metrics.billed_charge_local_micro?.[i] ?? 0) / 1_000_000,
            conversions: Number(metrics.conversion_purchases?.[i] ?? 0),
            conversionsValue:
              Number(metrics.conversion_purchases_value_micros_usd?.[i] ?? 0) /
              1_000_000,
          });
        }
      }
    }

    return rows;
  }
}

function expandUtcDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export type XAdsCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
};

export type XAdsCampaignPerformanceDaily = {
  date: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  channelType: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
};
