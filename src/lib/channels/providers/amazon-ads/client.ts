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
}
