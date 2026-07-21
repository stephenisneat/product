import {
  customerResourceName,
  getGoogleAdsConfig,
  normalizeCustomerId,
  refreshGoogleAdsAccessToken,
} from "./oauth";
import type {
  CreateCampaignInput,
  GoogleAdsAccessibleCustomer,
  GoogleAdsAdGroup,
  GoogleAdsCampaign,
  GoogleAdsCustomerDetail,
  GoogleAdsMutateOperation,
  GoogleAdsSearchRow,
} from "./types";
import { BIDDING_STRATEGIES, CAMPAIGN_STATUS } from "./types";

export type GoogleAdsClientCredentials = {
  accessToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  /** Called when access token is refreshed so callers can persist it. */
  onTokenRefresh?: (tokens: {
    accessToken: string;
    expiresAt: string;
  }) => Promise<void> | void;
};

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

function microsFromAmount(amount: number): string {
  return String(Math.round(amount * 1_000_000));
}

function amountFromMicros(micros: string | number | undefined): number | undefined {
  if (micros == null) return undefined;
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (!Number.isFinite(n)) return undefined;
  return n / 1_000_000;
}

async function parseError(response: Response): Promise<GoogleAdsApiError> {
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
      : `Google Ads API HTTP ${response.status}`;
  return new GoogleAdsApiError(message, response.status, body);
}

/**
 * Low-level Google Ads REST client.
 * Exposes search (GAQL) and mutate for full API coverage, plus typed helpers
 * for Search / Display / YouTube campaign management.
 */
export class GoogleAdsClient {
  private accessToken: string;

  constructor(private readonly creds: GoogleAdsClientCredentials) {
    this.accessToken = creds.accessToken;
  }

  private headers(includeLoginCustomer = true): HeadersInit {
    const config = getGoogleAdsConfig();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "developer-token": config.developerToken,
      "Content-Type": "application/json",
    };
    if (includeLoginCustomer && this.creds.loginCustomerId) {
      headers["login-customer-id"] = normalizeCustomerId(
        this.creds.loginCustomerId,
      );
    }
    return headers;
  }

  private baseUrl(): string {
    const { apiVersion } = getGoogleAdsConfig();
    return `https://googleads.googleapis.com/${apiVersion}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryOnAuth?: boolean } = {},
  ): Promise<T> {
    const { retryOnAuth = true, ...fetchInit } = init;
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...fetchInit,
      headers: {
        ...this.headers(),
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
    const tokens = await refreshGoogleAdsAccessToken(this.creds.refreshToken);
    this.accessToken = tokens.accessToken;
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000,
    ).toISOString();
    await this.creds.onTokenRefresh?.({
      accessToken: tokens.accessToken,
      expiresAt,
    });
  }

  /** List customer resource names accessible with this OAuth credential. */
  static async listAccessibleCustomers(
    accessToken: string,
  ): Promise<GoogleAdsAccessibleCustomer[]> {
    const config = getGoogleAdsConfig();
    const response = await fetch(
      `https://googleads.googleapis.com/${config.apiVersion}/customers:listAccessibleCustomers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": config.developerToken,
        },
      },
    );
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = (await response.json()) as {
      resourceNames?: string[];
    };
    return (body.resourceNames ?? []).map((resourceName) => ({
      resourceName,
      customerId: resourceName.replace(/^customers\//, ""),
    }));
  }

  /** Run a GAQL query — covers every readable resource in the API. */
  async search(
    query: string,
    opts?: { pageSize?: number; pageToken?: string },
  ): Promise<{ results: GoogleAdsSearchRow[]; nextPageToken?: string }> {
    const customerId = normalizeCustomerId(this.creds.customerId);
    const body = await this.request<{
      results?: GoogleAdsSearchRow[];
      nextPageToken?: string;
    }>(`/customers/${customerId}/googleAds:search`, {
      method: "POST",
      body: JSON.stringify({
        query,
        pageSize: opts?.pageSize ?? 10_000,
        pageToken: opts?.pageToken,
      }),
    });
    return {
      results: body.results ?? [],
      nextPageToken: body.nextPageToken,
    };
  }

  /** Stream all GAQL rows (paginated search under the hood). */
  async searchAll(query: string): Promise<GoogleAdsSearchRow[]> {
    const rows: GoogleAdsSearchRow[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.search(query, { pageToken });
      rows.push(...page.results);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return rows;
  }

  /**
   * Generic mutate against any resource service path.
   * Example resource: "campaigns", "adGroups", "adGroupCriteria", "assets".
   * This is the escape hatch for full API coverage.
   */
  async mutate(
    resource: string,
    operations: GoogleAdsMutateOperation[],
    opts?: { partialFailure?: boolean; validateOnly?: boolean },
  ): Promise<unknown> {
    const customerId = normalizeCustomerId(this.creds.customerId);
    const pathResource = resource.replace(/^\//, "");
    return this.request(`/customers/${customerId}/${pathResource}:mutate`, {
      method: "POST",
      body: JSON.stringify({
        operations: operations.map((op) => {
          if (op.remove) return { remove: op.remove };
          if (op.update) {
            return {
              update: op.update,
              updateMask: op.updateMask,
            };
          }
          return { create: op.create };
        }),
        partialFailure: opts?.partialFailure ?? false,
        validateOnly: opts?.validateOnly ?? false,
      }),
    });
  }

  /**
   * GoogleAdsService.Mutate — atomic multi-resource mutate in one request.
   * Accepts raw mutateOperations as defined by the REST API.
   */
  async mutateGoogleAds(
    mutateOperations: Record<string, unknown>[],
    opts?: { partialFailure?: boolean; validateOnly?: boolean },
  ): Promise<unknown> {
    const customerId = normalizeCustomerId(this.creds.customerId);
    return this.request(`/customers/${customerId}/googleAds:mutate`, {
      method: "POST",
      body: JSON.stringify({
        mutateOperations,
        partialFailure: opts?.partialFailure ?? false,
        validateOnly: opts?.validateOnly ?? false,
      }),
    });
  }

  /** List client accounts under a manager (MCC), if any. */
  async listClientCustomers(): Promise<GoogleAdsCustomerDetail[]> {
    const rows = await this.searchAll(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.test_account,
        customer_client.status
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
        AND customer_client.level <= 1
    `);
    return rows.map((row) => {
      const c = row.customerClient as Record<string, unknown>;
      return {
        customerId: String(c.id ?? ""),
        descriptiveName: String(c.descriptiveName ?? ""),
        currencyCode: String(c.currencyCode ?? "USD"),
        timeZone: String(c.timeZone ?? "America/New_York"),
        manager: Boolean(c.manager),
        testAccount: Boolean(c.testAccount),
      };
    });
  }

  async getCustomer(customerId?: string): Promise<GoogleAdsCustomerDetail> {
    const id = normalizeCustomerId(customerId ?? this.creds.customerId);
    const rows = await this.withCustomer(id).searchAll(`
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager,
        customer.test_account
      FROM customer
      LIMIT 1
    `);
    const customer = rows[0]?.customer as
      | {
          id?: string | number;
          descriptiveName?: string;
          currencyCode?: string;
          timeZone?: string;
          manager?: boolean;
          testAccount?: boolean;
        }
      | undefined;
    if (!customer?.id) {
      throw new GoogleAdsApiError("Customer not found", 404);
    }
    return {
      customerId: String(customer.id),
      descriptiveName: customer.descriptiveName ?? "",
      currencyCode: customer.currencyCode ?? "USD",
      timeZone: customer.timeZone ?? "America/New_York",
      manager: Boolean(customer.manager),
      testAccount: Boolean(customer.testAccount),
    };
  }

  /** Temporarily operate as another customer with the same tokens. */
  withCustomer(customerId: string, loginCustomerId?: string | null): GoogleAdsClient {
    return new GoogleAdsClient({
      ...this.creds,
      customerId,
      loginCustomerId:
        loginCustomerId === undefined
          ? this.creds.loginCustomerId
          : loginCustomerId,
      accessToken: this.accessToken,
    });
  }

  async listCampaigns(opts?: {
    channelTypes?: string[];
    statuses?: string[];
  }): Promise<GoogleAdsCampaign[]> {
    const filters: string[] = [];
    if (opts?.channelTypes?.length) {
      filters.push(
        `campaign.advertising_channel_type IN (${opts.channelTypes
          .map((t) => `'${t}'`)
          .join(", ")})`,
      );
    }
    if (opts?.statuses?.length) {
      filters.push(
        `campaign.status IN (${opts.statuses.map((s) => `'${s}'`).join(", ")})`,
      );
    } else {
      filters.push(`campaign.status != 'REMOVED'`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await this.searchAll(`
      SELECT
        campaign.resource_name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.campaign_budget,
        campaign.start_date,
        campaign.end_date
      FROM campaign
      ${where}
      ORDER BY campaign.name
    `);
    return rows.map((row) => {
      const c = row.campaign as Record<string, unknown>;
      return {
        resourceName: String(c.resourceName ?? ""),
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        status: String(c.status ?? ""),
        channelType: String(c.advertisingChannelType ?? ""),
        biddingStrategyType: c.biddingStrategyType
          ? String(c.biddingStrategyType)
          : undefined,
        campaignBudget: c.campaignBudget
          ? String(c.campaignBudget)
          : undefined,
        startDate: c.startDate ? String(c.startDate) : undefined,
        endDate: c.endDate ? String(c.endDate) : undefined,
      };
    });
  }

  async getCampaign(campaignId: string): Promise<GoogleAdsCampaign | null> {
    const id = campaignId.replace(/\D/g, "");
    const rows = await this.searchAll(`
      SELECT
        campaign.resource_name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.campaign_budget,
        campaign.start_date,
        campaign.end_date
      FROM campaign
      WHERE campaign.id = ${id}
      LIMIT 1
    `);
    const c = rows[0]?.campaign as Record<string, unknown> | undefined;
    if (!c) return null;
    return {
      resourceName: String(c.resourceName ?? ""),
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      status: String(c.status ?? ""),
      channelType: String(c.advertisingChannelType ?? ""),
      biddingStrategyType: c.biddingStrategyType
        ? String(c.biddingStrategyType)
        : undefined,
      campaignBudget: c.campaignBudget ? String(c.campaignBudget) : undefined,
      startDate: c.startDate ? String(c.startDate) : undefined,
      endDate: c.endDate ? String(c.endDate) : undefined,
    };
  }

  /**
   * Create a Search, Display, or YouTube (VIDEO) campaign with budget + bidding.
   * Uses googleAds:mutate for an atomic budget+campaign create.
   */
  async createCampaign(input: CreateCampaignInput): Promise<{
    campaignResourceName: string;
    budgetResourceName: string;
  }> {
    const customerId = normalizeCustomerId(this.creds.customerId);
    const status = input.status ?? CAMPAIGN_STATUS.PAUSED;
    const budgetTemp = `customers/${customerId}/campaignBudgets/-1`;
    const campaignTemp = `customers/${customerId}/campaigns/-2`;

    const campaign: Record<string, unknown> = {
      resourceName: campaignTemp,
      name: input.name,
      status,
      advertisingChannelType: input.channelType,
      campaignBudget: budgetTemp,
      containsEuPoliticalAdvertising:
        "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    };

    if (input.startDate) campaign.startDate = input.startDate;
    if (input.endDate) campaign.endDate = input.endDate;

    if (input.channelType === "SEARCH") {
      campaign.networkSettings = {
        targetGoogleSearch: input.networkSettings?.targetGoogleSearch ?? true,
        targetSearchNetwork: input.networkSettings?.targetSearchNetwork ?? true,
        targetContentNetwork:
          input.networkSettings?.targetContentNetwork ?? false,
        targetPartnerSearchNetwork:
          input.networkSettings?.targetPartnerSearchNetwork ?? false,
      };
    }

    if (input.channelType === "VIDEO" && input.videoCampaignSubtype) {
      campaign.advertisingChannelSubType = input.videoCampaignSubtype;
    }

    const bidding = input.biddingStrategy ?? BIDDING_STRATEGIES.MAXIMIZE_CLICKS;
    switch (bidding) {
      case BIDDING_STRATEGIES.MANUAL_CPC:
        campaign.manualCpc = { enhancedCpcEnabled: true };
        break;
      case BIDDING_STRATEGIES.MAXIMIZE_CLICKS:
        campaign.maximizeClicks = {};
        break;
      case BIDDING_STRATEGIES.MAXIMIZE_CONVERSIONS:
        campaign.maximizeConversions = {};
        break;
      case BIDDING_STRATEGIES.TARGET_CPA:
        campaign.targetCpa = {
          targetCpaMicros: microsFromAmount(input.targetCpa ?? 10),
        };
        break;
      case BIDDING_STRATEGIES.TARGET_ROAS:
        campaign.targetRoas = {
          targetRoas: input.targetRoas ?? 3,
        };
        break;
      case BIDDING_STRATEGIES.TARGET_SPEND:
        campaign.targetSpend = {};
        break;
      default:
        campaign.maximizeClicks = {};
    }

    const result = (await this.mutateGoogleAds([
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budgetTemp,
            name: `${input.name} Budget`,
            amountMicros: microsFromAmount(input.dailyBudget),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      },
      {
        campaignOperation: {
          create: campaign,
        },
      },
    ])) as {
      mutateOperationResponses?: {
        campaignBudgetResult?: { resourceName?: string };
        campaignResult?: { resourceName?: string };
      }[];
    };

    const responses = result.mutateOperationResponses ?? [];
    const budgetResourceName =
      responses[0]?.campaignBudgetResult?.resourceName ?? budgetTemp;
    const campaignResourceName =
      responses[1]?.campaignResult?.resourceName ?? campaignTemp;

    return { campaignResourceName, budgetResourceName };
  }

  async updateCampaignStatus(
    campaignResourceName: string,
    status: "ENABLED" | "PAUSED" | "REMOVED",
  ): Promise<unknown> {
    return this.mutate("campaigns", [
      {
        update: {
          resourceName: campaignResourceName,
          status,
        },
        updateMask: "status",
      },
    ]);
  }

  async updateCampaign(
    campaignResourceName: string,
    patch: {
      name?: string;
      status?: "ENABLED" | "PAUSED" | "REMOVED";
      startDate?: string;
      endDate?: string;
    },
  ): Promise<unknown> {
    const update: Record<string, unknown> = {
      resourceName: campaignResourceName,
    };
    const paths: string[] = [];
    if (patch.name != null) {
      update.name = patch.name;
      paths.push("name");
    }
    if (patch.status != null) {
      update.status = patch.status;
      paths.push("status");
    }
    if (patch.startDate != null) {
      update.startDate = patch.startDate;
      paths.push("start_date");
    }
    if (patch.endDate != null) {
      update.endDate = patch.endDate;
      paths.push("end_date");
    }
    if (paths.length === 0) {
      throw new Error("No campaign fields to update");
    }
    return this.mutate("campaigns", [
      { update, updateMask: paths.join(",") },
    ]);
  }

  async listAdGroups(campaignId?: string): Promise<GoogleAdsAdGroup[]> {
    const where = campaignId
      ? `WHERE ad_group.campaign = '${customerResourceName(this.creds.customerId)}/campaigns/${campaignId.replace(/\D/g, "")}' AND ad_group.status != 'REMOVED'`
      : `WHERE ad_group.status != 'REMOVED'`;
    const rows = await this.searchAll(`
      SELECT
        ad_group.resource_name,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.campaign,
        ad_group.type,
        ad_group.cpc_bid_micros
      FROM ad_group
      ${where}
      ORDER BY ad_group.name
    `);
    return rows.map((row) => {
      const g = row.adGroup as Record<string, unknown>;
      return {
        resourceName: String(g.resourceName ?? ""),
        id: String(g.id ?? ""),
        name: String(g.name ?? ""),
        status: String(g.status ?? ""),
        campaign: String(g.campaign ?? ""),
        type: g.type ? String(g.type) : undefined,
        cpcBidMicros: g.cpcBidMicros != null ? String(g.cpcBidMicros) : undefined,
      };
    });
  }

  async createAdGroup(input: {
    campaignResourceName: string;
    name: string;
    status?: "ENABLED" | "PAUSED";
    cpcBid?: number;
    type?: string;
  }): Promise<unknown> {
    const create: Record<string, unknown> = {
      name: input.name,
      campaign: input.campaignResourceName,
      status: input.status ?? "ENABLED",
    };
    if (input.cpcBid != null) {
      create.cpcBidMicros = microsFromAmount(input.cpcBid);
    }
    if (input.type) {
      create.type = input.type;
    }
    return this.mutate("adGroups", [{ create }]);
  }

  async updateAdGroupStatus(
    adGroupResourceName: string,
    status: "ENABLED" | "PAUSED" | "REMOVED",
  ): Promise<unknown> {
    return this.mutate("adGroups", [
      {
        update: { resourceName: adGroupResourceName, status },
        updateMask: "status",
      },
    ]);
  }

  /** Add keywords (Search) as ad group criteria. */
  async addKeywords(
    adGroupResourceName: string,
    keywords: { text: string; matchType: "EXACT" | "PHRASE" | "BROAD" }[],
  ): Promise<unknown> {
    return this.mutate(
      "adGroupCriteria",
      keywords.map((kw) => ({
        create: {
          adGroup: adGroupResourceName,
          status: "ENABLED",
          keyword: {
            text: kw.text,
            matchType: kw.matchType,
          },
        },
      })),
    );
  }

  /** Create RSA (Search) or display/video ads via ad group ads. */
  async createAdGroupAd(input: {
    adGroupResourceName: string;
    status?: "ENABLED" | "PAUSED";
    /** Responsive search ad */
    responsiveSearchAd?: {
      headlines: string[];
      descriptions: string[];
      path1?: string;
      path2?: string;
      finalUrls: string[];
    };
    /** Responsive display ad */
    responsiveDisplayAd?: {
      headlines: string[];
      longHeadline: string;
      descriptions: string[];
      businessName: string;
      marketingImageAsset: string;
      squareMarketingImageAsset?: string;
      finalUrls: string[];
    };
    /** Video ad (in-stream / bumper etc.) */
    videoAd?: {
      videoAsset: string;
      adType: "IN_STREAM" | "BUMPER" | "OUT_STREAM" | "NON_SKIPPABLE_IN_STREAM";
      finalUrls: string[];
      actionButtonLabel?: string;
      actionHeadline?: string;
    };
  }): Promise<unknown> {
    const ad: Record<string, unknown> = {};
    if (input.responsiveSearchAd) {
      const rsa = input.responsiveSearchAd;
      ad.responsiveSearchAd = {
        headlines: rsa.headlines.map((text) => ({ text })),
        descriptions: rsa.descriptions.map((text) => ({ text })),
        path1: rsa.path1,
        path2: rsa.path2,
      };
      ad.finalUrls = rsa.finalUrls;
      ad.type = "RESPONSIVE_SEARCH_AD";
    } else if (input.responsiveDisplayAd) {
      const rda = input.responsiveDisplayAd;
      ad.responsiveDisplayAd = {
        headlines: rda.headlines.map((text) => ({ text })),
        longHeadline: { text: rda.longHeadline },
        descriptions: rda.descriptions.map((text) => ({ text })),
        businessName: rda.businessName,
        marketingImages: [{ asset: rda.marketingImageAsset }],
        squareMarketingImages: rda.squareMarketingImageAsset
          ? [{ asset: rda.squareMarketingImageAsset }]
          : undefined,
      };
      ad.finalUrls = rda.finalUrls;
      ad.type = "RESPONSIVE_DISPLAY_AD";
    } else if (input.videoAd) {
      const va = input.videoAd;
      const videoPayload: Record<string, unknown> = {
        video: { asset: va.videoAsset },
      };
      if (va.adType === "IN_STREAM") {
        ad.videoAd = {
          inStream: {
            actionButtonLabel: va.actionButtonLabel,
            actionHeadline: va.actionHeadline,
          },
          ...videoPayload,
        };
      } else if (va.adType === "BUMPER") {
        ad.videoAd = { bumper: {}, ...videoPayload };
      } else if (va.adType === "NON_SKIPPABLE_IN_STREAM") {
        ad.videoAd = { nonSkippable: {}, ...videoPayload };
      } else {
        ad.videoAd = { outStream: {}, ...videoPayload };
      }
      ad.finalUrls = va.finalUrls;
      ad.type = "VIDEO_AD";
    } else {
      throw new Error(
        "Provide responsiveSearchAd, responsiveDisplayAd, or videoAd",
      );
    }

    return this.mutate("adGroupAds", [
      {
        create: {
          adGroup: input.adGroupResourceName,
          status: input.status ?? "PAUSED",
          ad,
        },
      },
    ]);
  }

  async updateAdGroupAdStatus(
    adGroupAdResourceName: string,
    status: "ENABLED" | "PAUSED" | "REMOVED",
  ): Promise<unknown> {
    return this.mutate("adGroupAds", [
      {
        update: { resourceName: adGroupAdResourceName, status },
        updateMask: "status",
      },
    ]);
  }

  async updateCampaignBudget(
    budgetResourceName: string,
    dailyBudget: number,
  ): Promise<unknown> {
    return this.mutate("campaignBudgets", [
      {
        update: {
          resourceName: budgetResourceName,
          amountMicros: microsFromAmount(dailyBudget),
        },
        updateMask: "amount_micros",
      },
    ]);
  }

  /** Performance report via GAQL for campaigns (Search / Display / YouTube). */
  async getCampaignPerformance(opts: {
    startDate: string;
    endDate: string;
    campaignId?: string;
  }): Promise<
    {
      campaignId: string;
      campaignName: string;
      channelType: string;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
      conversionsValue: number;
    }[]
  > {
    const filters = [
      `segments.date BETWEEN '${opts.startDate}' AND '${opts.endDate}'`,
      `campaign.status != 'REMOVED'`,
    ];
    if (opts.campaignId) {
      filters.push(`campaign.id = ${opts.campaignId.replace(/\D/g, "")}`);
    }
    const rows = await this.searchAll(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${filters.join(" AND ")}
    `);
    return rows.map((row) => {
      const campaign = row.campaign as Record<string, unknown>;
      const metrics = row.metrics as Record<string, unknown>;
      return {
        campaignId: String(campaign.id ?? ""),
        campaignName: String(campaign.name ?? ""),
        channelType: String(campaign.advertisingChannelType ?? ""),
        impressions: Number(metrics.impressions ?? 0),
        clicks: Number(metrics.clicks ?? 0),
        cost: amountFromMicros(metrics.costMicros as string) ?? 0,
        conversions: Number(metrics.conversions ?? 0),
        conversionsValue: Number(metrics.conversionsValue ?? 0),
      };
    });
  }

  /** Upload an image asset (Display). Data must be base64. */
  async createImageAsset(input: {
    name: string;
    dataBase64: string;
  }): Promise<unknown> {
    return this.mutate("assets", [
      {
        create: {
          name: input.name,
          type: "IMAGE",
          imageAsset: {
            data: input.dataBase64,
          },
        },
      },
    ]);
  }

  /** Link a YouTube video asset by video ID. */
  async createYoutubeVideoAsset(input: {
    name: string;
    youtubeVideoId: string;
  }): Promise<unknown> {
    return this.mutate("assets", [
      {
        create: {
          name: input.name,
          type: "YOUTUBE_VIDEO",
          youtubeVideoAsset: {
            youtubeVideoId: input.youtubeVideoId,
          },
        },
      },
    ]);
  }
}

export { amountFromMicros, microsFromAmount };
