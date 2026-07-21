/** Google Ads OAuth + API configuration. */

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "openid",
  "email",
].join(" ");

const DEFAULT_API_VERSION = "v19";

export const GOOGLE_ADS_STATE_COOKIE = "google_ads_oauth_state";
export const GOOGLE_ADS_PENDING_COOKIE = "google_ads_pending_conn";

export function getGoogleAdsConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const scopes = process.env.GOOGLE_ADS_SCOPES || DEFAULT_SCOPES;
  const apiVersion =
    process.env.GOOGLE_ADS_API_VERSION?.replace(/^\/?/, "") ||
    DEFAULT_API_VERSION;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Ads is not configured. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.",
    );
  }
  if (!developerToken) {
    throw new Error(
      "Google Ads is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for Google Ads OAuth redirects.",
    );
  }

  const base = appUrl.replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    developerToken,
    scopes,
    apiVersion,
    appUrl: base,
    callbackUrl:
      process.env.GOOGLE_ADS_REDIRECT_URI ||
      `${base}/api/integrations/google-ads/callback`,
  };
}

export function hasGoogleAdsConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function buildGoogleAdsAuthorizeUrl(state: string): string {
  const config = getGoogleAdsConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: config.scopes,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleAdsTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

export async function exchangeGoogleAdsCode(
  code: string,
): Promise<GoogleAdsTokenResponse> {
  const config = getGoogleAdsConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Ads token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new Error("Google Ads token exchange returned no access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresIn: body.expires_in ?? 3600,
    scope: body.scope ?? config.scopes,
    tokenType: body.token_type ?? "Bearer",
  };
}

export async function refreshGoogleAdsAccessToken(
  refreshToken: string,
): Promise<Omit<GoogleAdsTokenResponse, "refreshToken">> {
  const config = getGoogleAdsConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Ads token refresh failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new Error("Google Ads token refresh returned no access_token");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 3600,
    scope: body.scope ?? config.scopes,
    tokenType: body.token_type ?? "Bearer",
  };
}

/** Normalize Google Ads customer IDs to digits only. */
export {
  formatCustomerId,
  normalizeCustomerId,
} from "./format";
import { normalizeCustomerId } from "./format";

export function customerResourceName(customerId: string): string {
  return `customers/${normalizeCustomerId(customerId)}`;
}
