/** TikTok Marketing API OAuth + configuration. */

const DEFAULT_SCOPES = "";

export const TIKTOK_STATE_COOKIE = "tiktok_ads_oauth_state";

export function getTikTokConfig() {
  const appId = process.env.TIKTOK_ADS_APP_ID;
  const appSecret = process.env.TIKTOK_ADS_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const scopes = process.env.TIKTOK_ADS_SCOPES || DEFAULT_SCOPES;

  if (!appId || !appSecret) {
    throw new Error(
      "TikTok Ads is not configured. Set TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for TikTok Ads OAuth redirects.",
    );
  }

  const base = appUrl.replace(/\/$/, "");
  return {
    appId,
    appSecret,
    scopes,
    appUrl: base,
    callbackUrl:
      process.env.TIKTOK_ADS_REDIRECT_URI ||
      `${base}/api/integrations/tiktok/callback`,
  };
}

export function hasTikTokConfig(): boolean {
  return Boolean(
    process.env.TIKTOK_ADS_APP_ID &&
      process.env.TIKTOK_ADS_APP_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function buildTikTokAuthorizeUrl(state: string): string {
  const config = getTikTokConfig();
  const params = new URLSearchParams({
    app_id: config.appId,
    redirect_uri: config.callbackUrl,
    state,
  });
  if (config.scopes) {
    params.set("rid", config.scopes);
  }
  return `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
}

export type TikTokTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  scope: string;
  advertiserIds: string[];
  tokenType: string;
};

type TikTokTokenApiData = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string | number[];
  advertiser_ids?: string[] | number[];
};

function parseTokenData(data: TikTokTokenApiData, fallbackScope: string): TikTokTokenResponse {
  if (!data.access_token || !data.refresh_token) {
    throw new Error("TikTok token response missing access_token or refresh_token");
  }
  const scope =
    typeof data.scope === "string"
      ? data.scope
      : Array.isArray(data.scope)
        ? data.scope.join(",")
        : fallbackScope;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 86400,
    refreshExpiresIn: data.refresh_token_expires_in ?? 0,
    scope,
    advertiserIds: (data.advertiser_ids ?? []).map(String),
    tokenType: "Bearer",
  };
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResponse> {
  const config = getTikTokConfig();
  const response = await fetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.appId,
        secret: config.appSecret,
        auth_code: code,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    code?: number;
    message?: string;
    data?: TikTokTokenApiData;
  };

  if (body.code !== 0 || !body.data) {
    throw new Error(
      `TikTok token exchange failed: ${body.message || `code ${body.code}`}`,
    );
  }

  return parseTokenData(body.data, config.scopes);
}

export async function refreshTikTokAccessToken(
  refreshToken: string,
): Promise<Omit<TikTokTokenResponse, "refreshToken" | "advertiserIds" | "refreshExpiresIn"> & {
  refreshToken?: string;
}> {
  const config = getTikTokConfig();
  const response = await fetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.appId,
        secret: config.appSecret,
        refresh_token: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok token refresh failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    code?: number;
    message?: string;
    data?: TikTokTokenApiData;
  };

  if (body.code !== 0 || !body.data?.access_token) {
    throw new Error(
      `TikTok token refresh failed: ${body.message || `code ${body.code}`}`,
    );
  }

  const parsed = parseTokenData(
    {
      ...body.data,
      refresh_token: body.data.refresh_token ?? refreshToken,
    },
    config.scopes,
  );

  return {
    accessToken: parsed.accessToken,
    expiresIn: parsed.expiresIn,
    scope: parsed.scope,
    tokenType: parsed.tokenType,
    refreshToken: parsed.refreshToken,
  };
}
