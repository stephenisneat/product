import { refreshTikTokAccessToken } from "./oauth";

export type TikTokAdvertiser = {
  accountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
};

export type TikTokClientCredentials = {
  accessToken: string;
  refreshToken: string;
  advertiserId?: string;
  onTokenRefresh?: (tokens: {
    accessToken: string;
    expiresAt: string;
  }) => Promise<void> | void;
};

export class TikTokApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "TikTokApiError";
  }
}

async function parseError(response: Response): Promise<TikTokApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => undefined);
  }
  const message =
    typeof body === "object" &&
    body &&
    "message" in body &&
    typeof (body as { message?: string }).message === "string"
      ? (body as { message: string }).message
      : `TikTok API HTTP ${response.status}`;
  return new TikTokApiError(message, response.status, body);
}

export class TikTokClient {
  private accessToken: string;

  constructor(private readonly creds: TikTokClientCredentials) {
    this.accessToken = creds.accessToken;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryOnAuth?: boolean } = {},
  ): Promise<T> {
    const { retryOnAuth = true, ...fetchInit } = init;
    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3${path}`,
      {
        ...fetchInit,
        headers: {
          "Access-Token": this.accessToken,
          "Content-Type": "application/json",
          ...(fetchInit.headers as Record<string, string> | undefined),
        },
      },
    );

    if (response.status === 401 && retryOnAuth) {
      await this.refreshAccessToken();
      return this.request<T>(path, { ...init, retryOnAuth: false });
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    const body = (await response.json()) as {
      code?: number;
      message?: string;
      data?: T;
    };

    if (body.code !== 0) {
      throw new TikTokApiError(
        body.message || `TikTok API error code ${body.code}`,
        response.status,
        body,
      );
    }

    return body.data as T;
  }

  private async refreshAccessToken(): Promise<void> {
    const tokens = await refreshTikTokAccessToken(this.creds.refreshToken);
    this.accessToken = tokens.accessToken;
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000,
    ).toISOString();
    await this.creds.onTokenRefresh?.({
      accessToken: tokens.accessToken,
      expiresAt,
    });
  }

  /** List advertisers authorized for this OAuth credential. */
  static async listAdvertisers(
    accessToken: string,
    appId: string,
    appSecret: string,
  ): Promise<TikTokAdvertiser[]> {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/",
      {
        method: "GET",
        headers: {
          "Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      },
    );

    // TikTok also accepts app_id/secret as query for this endpoint in some setups;
    // prefer Access-Token header (authorized advertisers for the token).
    if (!response.ok) {
      // Fallback with app credentials in query if header-only fails.
      const params = new URLSearchParams({
        app_id: appId,
        secret: appSecret,
        access_token: accessToken,
      });
      const fallback = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?${params.toString()}`,
      );
      if (!fallback.ok) {
        throw await parseError(fallback);
      }
      return mapAdvertiserResponse(await fallback.json());
    }

    return mapAdvertiserResponse(await response.json());
  }

  private advertiserId(): string {
    const id = this.creds.advertiserId;
    if (!id) throw new Error("TikTok client has no advertiser selected.");
    return id;
  }

  async getAdvertiser(advertiserId: string): Promise<TikTokAdvertiser> {
    const data = await this.request<{
      list?: {
        advertiser_id?: string | number;
        name?: string;
        currency?: string;
        timezone?: string;
      }[];
    }>(
      `/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([advertiserId]))}`,
    );

    const row = data.list?.[0];
    if (!row) {
      throw new TikTokApiError("Advertiser not found", 404);
    }
    return {
      accountId: String(row.advertiser_id ?? advertiserId),
      name: row.name ?? `Advertiser ${advertiserId}`,
      currencyCode: row.currency ?? null,
      timeZone: row.timezone ?? null,
    };
  }

  async listCampaigns(): Promise<TikTokCampaign[]> {
    const queried = await this.request<{
      list?: {
        campaign_id?: string | number;
        campaign_name?: string;
        operation_status?: string;
        secondary_status?: string;
        budget?: number;
        objective_type?: string;
      }[];
    }>(
      `/campaign/get/?advertiser_id=${encodeURIComponent(this.advertiserId())}&page_size=100`,
    );

    return (queried.list ?? []).map((row) => ({
      id: String(row.campaign_id ?? ""),
      name: row.campaign_name ?? `Campaign ${row.campaign_id ?? ""}`,
      status: row.operation_status ?? row.secondary_status ?? "UNKNOWN",
      objective: row.objective_type ?? null,
      dailyBudget: row.budget != null ? Number(row.budget) : null,
    }));
  }

  async createCampaign(input: {
    name: string;
    objectiveType?: string;
    budget?: number;
    budgetMode?: string;
    status?: "ENABLE" | "DISABLE";
  }): Promise<{ id: string }> {
    const data = await this.request<{ campaign_id?: string | number }>(
      "/campaign/create/",
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: this.advertiserId(),
          campaign_name: input.name,
          objective_type: input.objectiveType ?? "TRAFFIC",
          budget_mode: input.budgetMode ?? "BUDGET_MODE_DAY",
          budget: input.budget ?? 50,
          operation_status: input.status ?? "DISABLE",
        }),
      },
    );
    if (data.campaign_id == null) {
      throw new TikTokApiError("TikTok campaign create returned no id", 502, data);
    }
    return { id: String(data.campaign_id) };
  }

  async updateCampaignStatus(
    campaignId: string,
    status: "ENABLE" | "DISABLE",
  ): Promise<void> {
    await this.request("/campaign/status/update/", {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: this.advertiserId(),
        campaign_ids: [campaignId],
        operation_status: status,
      }),
    });
  }

  async getCampaignPerformanceDaily(opts: {
    startDate: string;
    endDate: string;
  }): Promise<TikTokCampaignPerformanceDaily[]> {
    const data = await this.request<{
      list?: {
        dimensions?: {
          campaign_id?: string;
          stat_time_day?: string;
        };
        metrics?: {
          campaign_name?: string;
          spend?: string;
          impressions?: string;
          clicks?: string;
          conversion?: string;
          total_complete_payment_rate?: string;
          currency?: string;
        };
      }[];
    }>("/report/integrated/get/", {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: this.advertiserId(),
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: ["campaign_id", "stat_time_day"],
        metrics: [
          "campaign_name",
          "spend",
          "impressions",
          "clicks",
          "conversion",
          "total_complete_payment_rate",
        ],
        start_date: opts.startDate,
        end_date: opts.endDate,
        page_size: 1000,
      }),
    });

    return (data.list ?? [])
      .map((row) => {
        const campaignId = String(row.dimensions?.campaign_id ?? "");
        const date = String(row.dimensions?.stat_time_day ?? "").slice(0, 10);
        if (!campaignId || !date) return null;
        return {
          date,
          campaignId,
          campaignName:
            row.metrics?.campaign_name ?? `Campaign ${campaignId}`,
          campaignStatus: "ENABLE",
          channelType: "TIKTOK",
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          spend: Number(row.metrics?.spend ?? 0),
          conversions: Number(row.metrics?.conversion ?? 0),
          conversionsValue: Number(
            row.metrics?.total_complete_payment_rate ?? 0,
          ),
        } satisfies TikTokCampaignPerformanceDaily;
      })
      .filter((row): row is TikTokCampaignPerformanceDaily => row != null);
  }
}

export type TikTokCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
};

export type TikTokCampaignPerformanceDaily = {
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

function mapAdvertiserResponse(body: unknown): TikTokAdvertiser[] {
  const parsed = body as {
    code?: number;
    message?: string;
    data?: {
      list?: {
        advertiser_id?: string | number;
        advertiser_name?: string;
        name?: string;
        currency?: string;
        timezone?: string;
      }[];
    };
  };
  if (parsed.code !== 0) {
    throw new TikTokApiError(
      parsed.message || `TikTok API error code ${parsed.code}`,
      502,
      body,
    );
  }
  return (parsed.data?.list ?? []).map((row) => {
    const accountId = String(row.advertiser_id ?? "");
    return {
      accountId,
      name: row.advertiser_name ?? row.name ?? `Advertiser ${accountId}`,
      currencyCode: row.currency ?? null,
      timeZone: row.timezone ?? null,
    };
  });
}
