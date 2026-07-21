const STATE_COOKIE = "amazon_oauth_state";
const DEFAULT_MARKETPLACE_ID = "ATVPDKIKX0DER"; // US

export type AmazonTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sellerId?: string;
};

export function getAmazonConfig() {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  const applicationId = process.env.AMAZON_SP_API_APP_ID;
  const marketplaceId =
    process.env.AMAZON_MARKETPLACE_ID || DEFAULT_MARKETPLACE_ID;
  const spApiEndpoint =
    process.env.AMAZON_SP_API_ENDPOINT || "https://sellingpartnerapi-na.amazon.com";
  const sellerCentralUrl =
    process.env.AMAZON_SELLER_CENTRAL_URL ||
    "https://sellercentral.amazon.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Amazon is not configured. Set AMAZON_LWA_CLIENT_ID and AMAZON_LWA_CLIENT_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for Amazon OAuth redirects.");
  }

  return {
    clientId,
    clientSecret,
    applicationId,
    marketplaceId,
    spApiEndpoint: spApiEndpoint.replace(/\/$/, ""),
    sellerCentralUrl: sellerCentralUrl.replace(/\/$/, ""),
    appUrl: appUrl.replace(/\/$/, ""),
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/integrations/amazon/callback`,
  };
}

export function hasAmazonConfig(): boolean {
  return Boolean(
    process.env.AMAZON_LWA_CLIENT_ID &&
      process.env.AMAZON_LWA_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function normalizeMarketplaceId(input: string): string {
  const value = input.trim().toUpperCase();
  if (!value) return DEFAULT_MARKETPLACE_ID;
  if (!/^[A-Z0-9]+$/.test(value)) {
    throw new Error("Enter a valid Amazon marketplace ID (e.g. ATVPDKIKX0DER).");
  }
  return value;
}

export function buildAuthorizeUrl(state: string, marketplaceId?: string): string {
  const config = getAmazonConfig();
  if (!config.applicationId) {
    throw new Error(
      "Amazon is not configured. Set AMAZON_SP_API_APP_ID for Seller Central consent.",
    );
  }

  const params = new URLSearchParams({
    application_id: config.applicationId,
    state,
    redirect_uri: config.callbackUrl,
  });
  if (marketplaceId) {
    params.set("version", "beta");
  }
  return `${config.sellerCentralUrl}/apps/authorize/consent?${params.toString()}`;
}

export async function exchangeAmazonCode(
  code: string,
): Promise<AmazonTokenPayload> {
  const config = getAmazonConfig();
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amazon token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error("Amazon token exchange returned incomplete tokens");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

export async function refreshAmazonToken(
  refreshToken: string,
): Promise<AmazonTokenPayload> {
  const config = getAmazonConfig();
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
    throw new Error(`Amazon token refresh failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw new Error("Amazon token refresh returned no access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

export function encodeTokenPayload(payload: AmazonTokenPayload): string {
  return JSON.stringify(payload);
}

export function decodeTokenPayload(payload: string): AmazonTokenPayload {
  const parsed = JSON.parse(payload) as Partial<AmazonTokenPayload>;
  if (!parsed.accessToken || !parsed.refreshToken) {
    throw new Error("Invalid Amazon token payload");
  }
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresAt: parsed.expiresAt ?? 0,
    sellerId: parsed.sellerId,
  };
}

export { STATE_COOKIE, DEFAULT_MARKETPLACE_ID };
