const STATE_COOKIE = "squarespace_oauth_state";
const DEFAULT_SCOPES = "website.products.read website.inventory.read";

export type SquarespaceTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

export function getSquarespaceConfig() {
  const clientId = process.env.SQUARESPACE_CLIENT_ID;
  const clientSecret = process.env.SQUARESPACE_CLIENT_SECRET;
  const scopes = process.env.SQUARESPACE_SCOPES || DEFAULT_SCOPES;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Squarespace is not configured. Set SQUARESPACE_CLIENT_ID and SQUARESPACE_CLIENT_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for Squarespace OAuth redirects.",
    );
  }

  return {
    clientId,
    clientSecret,
    scopes,
    appUrl: appUrl.replace(/\/$/, ""),
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/integrations/squarespace/callback`,
  };
}

export function hasSquarespaceConfig(): boolean {
  return Boolean(
    process.env.SQUARESPACE_CLIENT_ID &&
      process.env.SQUARESPACE_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function normalizeSiteId(input: string): string {
  let value = input.trim();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? value;
  value = value.replace(/\.squarespace\.com$/i, "");

  if (!value || /\s/.test(value)) {
    throw new Error(
      "Enter your Squarespace site ID or domain (e.g. example or example.com).",
    );
  }

  return value.toLowerCase();
}

export function buildAuthorizeUrl(state: string): string {
  const config = getSquarespaceConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: config.scopes,
    state,
    access_type: "offline",
  });
  return `https://login.squarespace.com/api/1/login/oauth/provider/authorize?${params.toString()}`;
}

export async function exchangeSquarespaceCode(
  code: string,
): Promise<SquarespaceTokenPayload> {
  const config = getSquarespaceConfig();
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(
    "https://login.squarespace.com/api/1/login/oauth/provider/tokens",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.callbackUrl,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Squarespace token exchange failed: ${text || response.status}`,
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw new Error("Squarespace token exchange returned no access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_in
      ? Date.now() + body.expires_in * 1000
      : undefined,
  };
}

export async function refreshSquarespaceToken(
  refreshToken: string,
): Promise<SquarespaceTokenPayload> {
  const config = getSquarespaceConfig();
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(
    "https://login.squarespace.com/api/1/login/oauth/provider/tokens",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Squarespace token refresh failed: ${text || response.status}`,
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw new Error("Squarespace token refresh returned no access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: body.expires_in
      ? Date.now() + body.expires_in * 1000
      : undefined,
  };
}

export function encodeTokenPayload(payload: SquarespaceTokenPayload): string {
  return JSON.stringify(payload);
}

export function decodeTokenPayload(payload: string): SquarespaceTokenPayload {
  // Support legacy plain access tokens
  if (!payload.startsWith("{")) {
    return { accessToken: payload };
  }
  const parsed = JSON.parse(payload) as Partial<SquarespaceTokenPayload>;
  if (!parsed.accessToken) {
    throw new Error("Invalid Squarespace token payload");
  }
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresAt: parsed.expiresAt,
  };
}

export { STATE_COOKIE };
