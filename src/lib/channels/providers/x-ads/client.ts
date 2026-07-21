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
}
