/** X Ads API OAuth 2.0 (PKCE) + configuration. */

import { createHash, randomBytes } from "node:crypto";

const DEFAULT_SCOPES = [
  "offline.access",
  "tweet.read",
  "users.read",
  "ads.read",
  "ads.write",
].join(" ");

export const X_ADS_STATE_COOKIE = "x_ads_oauth_state";

export function getXAdsConfig() {
  const clientId = process.env.X_ADS_CLIENT_ID;
  const clientSecret = process.env.X_ADS_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const scopes = process.env.X_ADS_SCOPES || DEFAULT_SCOPES;
  const apiVersion = process.env.X_ADS_API_VERSION?.replace(/^\/?/, "") || "12";

  if (!clientId || !clientSecret) {
    throw new Error(
      "X Ads is not configured. Set X_ADS_CLIENT_ID and X_ADS_CLIENT_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for X Ads OAuth redirects.",
    );
  }

  const base = appUrl.replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    scopes,
    apiVersion,
    appUrl: base,
    callbackUrl:
      process.env.X_ADS_REDIRECT_URI ||
      `${base}/api/integrations/x-ads/callback`,
  };
}

export function hasXAdsConfig(): boolean {
  return Boolean(
    process.env.X_ADS_CLIENT_ID &&
      process.env.X_ADS_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildXAdsAuthorizeUrl(
  state: string,
  codeChallenge: string,
): string {
  const config = getXAdsConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: config.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export type XAdsTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeXAdsCode(
  code: string,
  codeVerifier: string,
): Promise<XAdsTokenResponse> {
  const config = getXAdsConfig();
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X Ads token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error(
      "X Ads token exchange returned no access_token or refresh_token",
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in ?? 7200,
    scope: body.scope ?? config.scopes,
    tokenType: body.token_type ?? "bearer",
  };
}

export async function refreshXAdsAccessToken(
  refreshToken: string,
): Promise<XAdsTokenResponse> {
  const config = getXAdsConfig();
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: config.clientId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X Ads token refresh failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new Error("X Ads token refresh returned no access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresIn: body.expires_in ?? 7200,
    scope: body.scope ?? config.scopes,
    tokenType: body.token_type ?? "bearer",
  };
}
