/** Amazon Advertising API OAuth + configuration (separate from SP-API commerce). */

const DEFAULT_SCOPES = "advertising::campaign_management";

/** NA Advertising API endpoint; override via AMAZON_ADS_API_URL for EU/FE. */
const DEFAULT_API_URL = "https://advertising-api.amazon.com";

export const AMAZON_ADS_STATE_COOKIE = "amazon_ads_oauth_state";

export function getAmazonAdsConfig() {
  const clientId = process.env.AMAZON_ADS_CLIENT_ID;
  const clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const scopes = process.env.AMAZON_ADS_SCOPES || DEFAULT_SCOPES;
  const apiUrl = (
    process.env.AMAZON_ADS_API_URL || DEFAULT_API_URL
  ).replace(/\/$/, "");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Amazon Ads is not configured. Set AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for Amazon Ads OAuth redirects.",
    );
  }

  const base = appUrl.replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    scopes,
    apiUrl,
    appUrl: base,
    callbackUrl:
      process.env.AMAZON_ADS_REDIRECT_URI ||
      `${base}/api/integrations/amazon-ads/callback`,
  };
}

export function hasAmazonAdsConfig(): boolean {
  return Boolean(
    process.env.AMAZON_ADS_CLIENT_ID &&
      process.env.AMAZON_ADS_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function buildAmazonAdsAuthorizeUrl(state: string): string {
  const config = getAmazonAdsConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes,
    response_type: "code",
    redirect_uri: config.callbackUrl,
    state,
  });
  return `https://www.amazon.com/ap/oa?${params.toString()}`;
}

export type AmazonAdsTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

export async function exchangeAmazonAdsCode(
  code: string,
): Promise<AmazonAdsTokenResponse> {
  const config = getAmazonAdsConfig();
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amazon Ads token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error(
      "Amazon Ads token exchange returned no access_token or refresh_token",
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in ?? 3600,
    scope: config.scopes,
    tokenType: body.token_type ?? "bearer",
  };
}

export async function refreshAmazonAdsAccessToken(
  refreshToken: string,
): Promise<Omit<AmazonAdsTokenResponse, "refreshToken">> {
  const config = getAmazonAdsConfig();
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amazon Ads token refresh failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new Error("Amazon Ads token refresh returned no access_token");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 3600,
    scope: config.scopes,
    tokenType: body.token_type ?? "bearer",
  };
}
