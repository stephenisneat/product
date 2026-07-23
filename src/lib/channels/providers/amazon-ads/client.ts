import { getAmazonAdsConfig, refreshAmazonAdsAccessToken } from "./oauth";

export type AmazonAdsProfile = {
  accountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
  countryCode: string | null;
  accountType: string | null;
};

export type AmazonAdsClientCredentials = {
  accessToken: string;
  refreshToken: string;
  profileId?: string;
  onTokenRefresh?: (tokens: {
    accessToken: string;
    expiresAt: string;
  }) => Promise<void> | void;
};

export class AmazonAdsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "AmazonAdsApiError";
  }
}

async function parseError(response: Response): Promise<AmazonAdsApiError> {
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
      : `Amazon Ads API HTTP ${response.status}`;
  return new AmazonAdsApiError(message, response.status, body);
}

export class AmazonAdsClient {
  private accessToken: string;

  constructor(private readonly creds: AmazonAdsClientCredentials) {
    this.accessToken = creds.accessToken;
  }

  private headers(profileId?: string): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Amazon-Advertising-API-ClientId": getAmazonAdsConfig().clientId,
      "Content-Type": "application/json",
    };
    if (profileId) {
      headers["Amazon-Advertising-API-Scope"] = profileId;
    }
    return headers;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryOnAuth?: boolean; profileId?: string } = {},
  ): Promise<T> {
    const { retryOnAuth = true, profileId, ...fetchInit } = init;
    const config = getAmazonAdsConfig();
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...fetchInit,
      headers: {
        ...this.headers(profileId ?? this.creds.profileId),
        ...(fetchInit.headers as Record<string, string> | undefined),
      },
    });

    if (response.status === 401 && retryOnAuth) {
      await this.refreshAccessToken();
      return this.request<T>(path, { ...init, retryOnAuth: false });
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async refreshAccessToken(): Promise<void> {
    const tokens = await refreshAmazonAdsAccessToken(this.creds.refreshToken);
    this.accessToken = tokens.accessToken;
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000,
    ).toISOString();
    await this.creds.onTokenRefresh?.({
      accessToken: tokens.accessToken,
      expiresAt,
    });
  }

  /** List advertising profiles accessible with this OAuth credential. */
  static async listProfiles(accessToken: string): Promise<AmazonAdsProfile[]> {
    const config = getAmazonAdsConfig();
    const response = await fetch(`${config.apiUrl}/v2/profiles`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Amazon-Advertising-API-ClientId": config.clientId,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = (await response.json()) as {
      profileId?: number | string;
      countryCode?: string;
      currencyCode?: string;
      timezone?: string;
      accountInfo?: {
        name?: string;
        type?: string;
        id?: string;
      };
    }[];

    return (Array.isArray(body) ? body : []).map((row) => {
      const accountId = String(row.profileId ?? "");
      return {
        accountId,
        name:
          row.accountInfo?.name ||
          (row.countryCode
            ? `${row.countryCode} profile ${accountId}`
            : `Profile ${accountId}`),
        currencyCode: row.currencyCode ?? null,
        timeZone: row.timezone ?? null,
        countryCode: row.countryCode ?? null,
        accountType: row.accountInfo?.type ?? null,
      };
    });
  }

  private profileId(): string {
    const id = this.creds.profileId;
    if (!id) throw new Error("Amazon Ads client has no profile selected.");
    return id;
  }

  async getProfile(profileId: string): Promise<AmazonAdsProfile> {
    const profiles = await this.request<
      {
        profileId?: number | string;
        countryCode?: string;
        currencyCode?: string;
        timezone?: string;
        accountInfo?: { name?: string; type?: string };
      }[]
    >("/v2/profiles");
    const row = (Array.isArray(profiles) ? profiles : []).find(
      (p) => String(p.profileId) === String(profileId),
    );
    if (!row) {
      throw new AmazonAdsApiError("Profile not found", 404);
    }
    return {
      accountId: String(row.profileId),
      name:
        row.accountInfo?.name ||
        (row.countryCode
          ? `${row.countryCode} profile ${profileId}`
          : `Profile ${profileId}`),
      currencyCode: row.currencyCode ?? null,
      timeZone: row.timezone ?? null,
      countryCode: row.countryCode ?? null,
      accountType: row.accountInfo?.type ?? null,
    };
  }

  async listCampaigns(): Promise<AmazonAdsCampaign[]> {
    const body = await this.request<
      {
        campaignId?: number | string;
        name?: string;
        state?: string;
        dailyBudget?: number;
        targetingType?: string;
      }[]
    >("/v2/sp/campaigns", { profileId: this.profileId() });

    return (Array.isArray(body) ? body : []).map((row) => ({
      id: String(row.campaignId ?? ""),
      name: row.name ?? `Campaign ${row.campaignId ?? ""}`,
      status: row.state ?? "UNKNOWN",
      objective: row.targetingType ?? "SP",
      dailyBudget: row.dailyBudget != null ? Number(row.dailyBudget) : null,
    }));
  }

  async createCampaign(input: {
    name: string;
    dailyBudget: number;
    state?: "enabled" | "paused";
    targetingType?: "manual" | "auto";
    startDate?: string;
  }): Promise<{ id: string }> {
    const startDate =
      input.startDate ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const body = await this.request<
      { campaignId?: number | string; code?: string; details?: string }[]
    >("/v2/sp/campaigns", {
      method: "POST",
      profileId: this.profileId(),
      body: JSON.stringify([
        {
          name: input.name,
          campaignType: "sponsoredProducts",
          targetingType: input.targetingType ?? "manual",
          state: input.state ?? "paused",
          dailyBudget: input.dailyBudget,
          startDate,
        },
      ]),
    });
    const row = Array.isArray(body) ? body[0] : null;
    if (!row?.campaignId) {
      throw new AmazonAdsApiError(
        row?.details || "Amazon Ads campaign create failed",
        502,
        body,
      );
    }
    return { id: String(row.campaignId) };
  }

  async updateCampaignStatus(
    campaignId: string,
    state: "enabled" | "paused",
  ): Promise<void> {
    await this.request("/v2/sp/campaigns", {
      method: "PUT",
      profileId: this.profileId(),
      body: JSON.stringify([{ campaignId: Number(campaignId), state }]),
    });
  }

  /**
   * Request + poll Amazon Ads Reporting API v3 for daily SP campaign metrics.
   */
  async getCampaignPerformanceDaily(opts: {
    startDate: string;
    endDate: string;
  }): Promise<AmazonAdsCampaignPerformanceDaily[]> {
    const created = await this.request<{ reportId?: string }>(
      "/reporting/reports",
      {
        method: "POST",
        profileId: this.profileId(),
        body: JSON.stringify({
          name: `pa-sync-${opts.startDate}-${opts.endDate}`,
          startDate: opts.startDate,
          endDate: opts.endDate,
          configuration: {
            adProduct: "SPONSORED_PRODUCTS",
            groupBy: ["campaign"],
            columns: [
              "date",
              "campaignId",
              "campaignName",
              "campaignStatus",
              "impressions",
              "clicks",
              "cost",
              "purchases1d",
              "sales1d",
            ],
            reportTypeId: "spCampaigns",
            timeUnit: "DAILY",
            format: "GZIP_JSON",
          },
        }),
      },
    );

    const reportId = created.reportId;
    if (!reportId) {
      throw new AmazonAdsApiError("Amazon Ads report create returned no id", 502, created);
    }

    let downloadUrl: string | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const status = await this.request<{
        status?: string;
        url?: string;
        failureReason?: string;
      }>(`/reporting/reports/${encodeURIComponent(reportId)}`, {
        profileId: this.profileId(),
      });
      if (status.status === "COMPLETED" && status.url) {
        downloadUrl = status.url;
        break;
      }
      if (status.status === "FAILURE") {
        throw new AmazonAdsApiError(
          status.failureReason || "Amazon Ads report failed",
          502,
          status,
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!downloadUrl) {
      throw new AmazonAdsApiError("Amazon Ads report timed out", 504);
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new AmazonAdsApiError(
        `Failed to download Amazon Ads report (${response.status})`,
        response.status,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { gunzipSync } = await import("node:zlib");
    let jsonText: string;
    try {
      jsonText = gunzipSync(buffer).toString("utf8");
    } catch {
      jsonText = buffer.toString("utf8");
    }

    const parsed = JSON.parse(jsonText) as
      | {
          date?: string;
          campaignId?: string | number;
          campaignName?: string;
          campaignStatus?: string;
          impressions?: number;
          clicks?: number;
          cost?: number;
          purchases1d?: number;
          sales1d?: number;
        }[]
      | { rows?: unknown[] };

    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.rows)
        ? (parsed.rows as typeof parsed extends { rows?: infer R } ? R : never)
        : [];

    return (rows as {
      date?: string;
      campaignId?: string | number;
      campaignName?: string;
      campaignStatus?: string;
      impressions?: number;
      clicks?: number;
      cost?: number;
      purchases1d?: number;
      sales1d?: number;
    }[])
      .map((row) => {
        const campaignId = String(row.campaignId ?? "");
        const date = String(row.date ?? "").slice(0, 10);
        if (!campaignId || !date) return null;
        return {
          date,
          campaignId,
          campaignName: row.campaignName ?? `Campaign ${campaignId}`,
          campaignStatus: row.campaignStatus ?? "UNKNOWN",
          channelType: "SP",
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          spend: Number(row.cost ?? 0),
          conversions: Number(row.purchases1d ?? 0),
          conversionsValue: Number(row.sales1d ?? 0),
        } satisfies AmazonAdsCampaignPerformanceDaily;
      })
      .filter((row): row is AmazonAdsCampaignPerformanceDaily => row != null);
  }
}

export type AmazonAdsCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
};

export type AmazonAdsCampaignPerformanceDaily = {
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
