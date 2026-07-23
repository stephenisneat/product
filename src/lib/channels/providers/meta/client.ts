import { getMetaConfig, refreshMetaAccessToken } from "./oauth";

export type MetaAdAccount = {
  accountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
  accountStatus: number | null;
};

export type MetaClientCredentials = {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  onTokenRefresh?: (tokens: {
    accessToken: string;
    expiresAt: string;
  }) => Promise<void> | void;
};

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function parseError(response: Response): Promise<MetaApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => undefined);
  }
  const message =
    typeof body === "object" &&
    body &&
    "error" in body &&
    typeof (body as { error?: { message?: string } }).error?.message === "string"
      ? (body as { error: { message: string } }).error.message
      : `Meta API HTTP ${response.status}`;
  return new MetaApiError(message, response.status, body);
}

export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
};

export type MetaCampaignPerformanceDaily = {
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

export type MetaCreateCampaignInput = {
  name: string;
  objective?: string;
  status?: "ACTIVE" | "PAUSED";
  /** Daily budget in account currency major units (e.g. USD). */
  dailyBudget?: number;
  specialAdCategories?: string[];
};

/**
 * Meta Marketing API client — accounts, campaigns, insights, and basic ads.
 */
export class MetaClient {
  private accessToken: string;

  constructor(private readonly creds: MetaClientCredentials) {
    this.accessToken = creds.accessToken;
  }

  private accountId(): string {
    const id = this.creds.accountId?.replace(/^act_/, "");
    if (!id) throw new Error("Meta client has no ad account selected.");
    return id;
  }

  private actPath(suffix = ""): string {
    return `/act_${this.accountId()}${suffix}`;
  }

  private baseUrl(): string {
    const { apiVersion } = getMetaConfig();
    return `https://graph.facebook.com/${apiVersion}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryOnAuth?: boolean } = {},
  ): Promise<T> {
    const { retryOnAuth = true, ...fetchInit } = init;
    const url = new URL(`${this.baseUrl()}${path}`);
    if (!url.searchParams.has("access_token")) {
      url.searchParams.set("access_token", this.accessToken);
    }

    const response = await fetch(url.toString(), fetchInit);

    if (response.status === 401 && retryOnAuth) {
      await this.refreshAccessToken();
      return this.request<T>(path, { ...init, retryOnAuth: false });
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    return (await response.json()) as T;
  }

  private async refreshAccessToken(): Promise<void> {
    const tokens = await refreshMetaAccessToken(this.creds.refreshToken);
    this.accessToken = tokens.accessToken;
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000,
    ).toISOString();
    await this.creds.onTokenRefresh?.({
      accessToken: tokens.accessToken,
      expiresAt,
    });
  }

  /** List ad accounts accessible with this OAuth credential. */
  static async listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const config = getMetaConfig();
    const params = new URLSearchParams({
      fields: "account_id,name,currency,timezone_name,account_status",
      limit: "100",
      access_token: accessToken,
    });
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/me/adaccounts?${params.toString()}`,
    );
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = (await response.json()) as {
      data?: {
        account_id?: string;
        id?: string;
        name?: string;
        currency?: string;
        timezone_name?: string;
        account_status?: number;
      }[];
    };

    return (body.data ?? []).map((row) => {
      const accountId = String(row.account_id ?? row.id?.replace(/^act_/, "") ?? "");
      return {
        accountId,
        name: row.name ?? `Ad account ${accountId}`,
        currencyCode: row.currency ?? null,
        timeZone: row.timezone_name ?? null,
        accountStatus: row.account_status ?? null,
      };
    });
  }

  async getAdAccount(accountId: string): Promise<MetaAdAccount> {
    const id = accountId.replace(/^act_/, "");
    const body = await this.request<{
      account_id?: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
      account_status?: number;
    }>(`/act_${id}?fields=account_id,name,currency,timezone_name,account_status`);

    return {
      accountId: String(body.account_id ?? id),
      name: body.name ?? `Ad account ${id}`,
      currencyCode: body.currency ?? null,
      timeZone: body.timezone_name ?? null,
      accountStatus: body.account_status ?? null,
    };
  }

  async listCampaigns(): Promise<MetaCampaign[]> {
    const body = await this.request<{
      data?: {
        id?: string;
        name?: string;
        status?: string;
        effective_status?: string;
        objective?: string;
        daily_budget?: string;
      }[];
    }>(
      `${this.actPath("/campaigns")}?fields=id,name,status,effective_status,objective,daily_budget&limit=200`,
    );

    return (body.data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: row.name ?? `Campaign ${row.id ?? ""}`,
      status: row.effective_status ?? row.status ?? "UNKNOWN",
      objective: row.objective ?? null,
      dailyBudget:
        row.daily_budget != null ? Number(row.daily_budget) / 100 : null,
    }));
  }

  async createCampaign(
    input: MetaCreateCampaignInput,
  ): Promise<{ id: string }> {
    const params = new URLSearchParams({
      name: input.name,
      objective: input.objective ?? "OUTCOME_TRAFFIC",
      status: input.status ?? "PAUSED",
      special_ad_categories: JSON.stringify(input.specialAdCategories ?? []),
    });
    if (input.dailyBudget != null && input.dailyBudget > 0) {
      // Meta expects cents for most currencies.
      params.set("daily_budget", String(Math.round(input.dailyBudget * 100)));
      params.set("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
    }

    const body = await this.request<{ id?: string }>(this.actPath("/campaigns"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!body.id) throw new MetaApiError("Meta campaign create returned no id", 502, body);
    return { id: body.id };
  }

  async updateCampaignStatus(
    campaignId: string,
    status: "ACTIVE" | "PAUSED",
  ): Promise<void> {
    const params = new URLSearchParams({ status });
    await this.request(`/${encodeURIComponent(campaignId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  }

  /** Upload an image by public URL; returns Meta image hash. */
  async createAdImageFromUrl(imageUrl: string): Promise<{ hash: string }> {
    const params = new URLSearchParams({ url: imageUrl });
    const body = await this.request<{
      images?: Record<string, { hash?: string }>;
    }>(this.actPath("/adimages"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const hash = Object.values(body.images ?? {})[0]?.hash;
    if (!hash) {
      throw new MetaApiError("Meta image upload returned no hash", 502, body);
    }
    return { hash };
  }

  async createAdSet(input: {
    name: string;
    campaignId: string;
    dailyBudget: number;
    status?: "ACTIVE" | "PAUSED";
    billingEvent?: string;
    optimizationGoal?: string;
    countries?: string[];
  }): Promise<{ id: string }> {
    const params = new URLSearchParams({
      name: input.name,
      campaign_id: input.campaignId,
      daily_budget: String(Math.round(input.dailyBudget * 100)),
      billing_event: input.billingEvent ?? "IMPRESSIONS",
      optimization_goal: input.optimizationGoal ?? "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status: input.status ?? "PAUSED",
      targeting: JSON.stringify({
        geo_locations: { countries: input.countries ?? ["US"] },
      }),
    });
    const body = await this.request<{ id?: string }>(this.actPath("/adsets"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!body.id) throw new MetaApiError("Meta ad set create returned no id", 502, body);
    return { id: body.id };
  }

  async createLinkAd(input: {
    name: string;
    adSetId: string;
    pageId: string;
    message: string;
    link: string;
    imageHash: string;
    headline?: string;
    description?: string;
    callToAction?: string;
    status?: "ACTIVE" | "PAUSED";
  }): Promise<{ id: string; creativeId: string }> {
    const creativeParams = new URLSearchParams({
      name: `${input.name} creative`,
      object_story_spec: JSON.stringify({
        page_id: input.pageId,
        link_data: {
          message: input.message,
          link: input.link,
          image_hash: input.imageHash,
          name: input.headline,
          description: input.description,
          call_to_action: {
            type: input.callToAction ?? "SHOP_NOW",
          },
        },
      }),
    });
    const creative = await this.request<{ id?: string }>(
      this.actPath("/adcreatives"),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: creativeParams.toString(),
      },
    );
    if (!creative.id) {
      throw new MetaApiError("Meta creative create returned no id", 502, creative);
    }

    const adParams = new URLSearchParams({
      name: input.name,
      adset_id: input.adSetId,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: input.status ?? "PAUSED",
    });
    const ad = await this.request<{ id?: string }>(this.actPath("/ads"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: adParams.toString(),
    });
    if (!ad.id) throw new MetaApiError("Meta ad create returned no id", 502, ad);
    return { id: ad.id, creativeId: creative.id };
  }

  async getCampaignPerformanceDaily(opts: {
    startDate: string;
    endDate: string;
  }): Promise<MetaCampaignPerformanceDaily[]> {
    type InsightsPage = {
      data?: {
        campaign_id?: string;
        campaign_name?: string;
        impressions?: string;
        clicks?: string;
        spend?: string;
        date_start?: string;
        actions?: { action_type?: string; value?: string }[];
        action_values?: { action_type?: string; value?: string }[];
      }[];
      paging?: { next?: string };
    };

    const timeRange = JSON.stringify({
      since: opts.startDate,
      until: opts.endDate,
    });
    const fields = [
      "campaign_id",
      "campaign_name",
      "impressions",
      "clicks",
      "spend",
      "actions",
      "action_values",
      "date_start",
    ].join(",");
    const params = new URLSearchParams({
      fields,
      level: "campaign",
      time_increment: "1",
      time_range: timeRange,
      limit: "500",
    });

    const rows: MetaCampaignPerformanceDaily[] = [];
    let nextUrl: string | null =
      `${this.baseUrl()}${this.actPath("/insights")}?${params.toString()}&access_token=${encodeURIComponent(this.accessToken)}`;

    while (nextUrl) {
      const response = await fetch(nextUrl);
      if (response.status === 401) {
        await this.refreshAccessToken();
        nextUrl = nextUrl.replace(
          /access_token=[^&]+/,
          `access_token=${encodeURIComponent(this.accessToken)}`,
        );
        continue;
      }
      if (!response.ok) {
        throw await parseError(response);
      }
      const body = (await response.json()) as InsightsPage;

      for (const row of body.data ?? []) {
        const campaignId = String(row.campaign_id ?? "");
        if (!campaignId || !row.date_start) continue;
        rows.push({
          date: row.date_start,
          campaignId,
          campaignName: row.campaign_name ?? `Campaign ${campaignId}`,
          campaignStatus: "ACTIVE",
          channelType: "META",
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          spend: Number(row.spend ?? 0),
          conversions: sumMetaActions(row.actions, [
            "purchase",
            "omni_purchase",
            "offsite_conversion.fb_pixel_purchase",
            "lead",
            "complete_registration",
          ]),
          conversionsValue: sumMetaActions(row.action_values, [
            "purchase",
            "omni_purchase",
            "offsite_conversion.fb_pixel_purchase",
          ]),
        });
      }

      nextUrl = body.paging?.next ?? null;
    }

    return rows;
  }
}

function sumMetaActions(
  actions: { action_type?: string; value?: string }[] | undefined,
  types: string[],
): number {
  if (!actions?.length) return 0;
  const wanted = new Set(types);
  return actions.reduce((sum, action) => {
    if (!action.action_type || !wanted.has(action.action_type)) return sum;
    return sum + Number(action.value ?? 0);
  }, 0);
}
