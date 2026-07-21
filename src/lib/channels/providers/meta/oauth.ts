/** Meta Marketing API OAuth + configuration. */

const DEFAULT_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "email",
].join(",");

const DEFAULT_API_VERSION = "v21.0";

export const META_STATE_COOKIE = "meta_ads_oauth_state";

export function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const scopes = process.env.META_SCOPES || DEFAULT_SCOPES;
  const apiVersion =
    process.env.META_API_VERSION?.replace(/^\/?/, "") || DEFAULT_API_VERSION;

  if (!appId || !appSecret) {
    throw new Error(
      "Meta Ads is not configured. Set META_APP_ID and META_APP_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for Meta Ads OAuth redirects.",
    );
  }

  const base = appUrl.replace(/\/$/, "");
  return {
    appId,
    appSecret,
    scopes,
    apiVersion,
    appUrl: base,
    callbackUrl:
      process.env.META_REDIRECT_URI ||
      `${base}/api/integrations/meta/callback`,
  };
}

export function hasMetaConfig(): boolean {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function buildMetaAuthorizeUrl(state: string): string {
  const config = getMetaConfig();
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: config.scopes,
    state,
  });
  return `https://www.facebook.com/${config.apiVersion}/dialog/oauth?${params.toString()}`;
}

export type MetaTokenResponse = {
  accessToken: string;
  /** Meta uses long-lived user tokens; stored as refresh_token for re-exchange. */
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const config = getMetaConfig();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${params.toString()}`,
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta long-lived token exchange failed: ${text || response.status}`);
  }
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error("Meta long-lived token exchange returned no access_token");
  }
  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function exchangeMetaCode(code: string): Promise<MetaTokenResponse> {
  const config = getMetaConfig();
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.callbackUrl,
    code,
  });
  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new Error("Meta token exchange returned no access_token");
  }

  const longLived = await exchangeForLongLivedToken(body.access_token);

  return {
    accessToken: longLived.accessToken,
    refreshToken: longLived.accessToken,
    expiresIn: longLived.expiresIn,
    scope: config.scopes,
    tokenType: body.token_type ?? "bearer",
  };
}

export async function refreshMetaAccessToken(
  refreshToken: string,
): Promise<Omit<MetaTokenResponse, "refreshToken">> {
  const longLived = await exchangeForLongLivedToken(refreshToken);
  const config = getMetaConfig();
  return {
    accessToken: longLived.accessToken,
    expiresIn: longLived.expiresIn,
    scope: config.scopes,
    tokenType: "bearer",
  };
}
