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

/**
 * Meta Marketing API client — account listing for OAuth connect.
 * Campaign management can be layered on the same credential later.
 */
export class MetaClient {
  private accessToken: string;

  constructor(private readonly creds: MetaClientCredentials) {
    this.accessToken = creds.accessToken;
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
}
