const STATE_COOKIE = "bigcommerce_oauth_state";
const DEFAULT_SCOPES = "store_v2_products_read_only store_v2_information_read_only";

export function getBigCommerceConfig() {
  const clientId = process.env.BIGCOMMERCE_CLIENT_ID;
  const clientSecret = process.env.BIGCOMMERCE_CLIENT_SECRET;
  const scopes = process.env.BIGCOMMERCE_SCOPES || DEFAULT_SCOPES;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret) {
    throw new Error(
      "BigCommerce is not configured. Set BIGCOMMERCE_CLIENT_ID and BIGCOMMERCE_CLIENT_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for BigCommerce OAuth redirects.");
  }

  return {
    clientId,
    clientSecret,
    scopes,
    appUrl: appUrl.replace(/\/$/, ""),
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/integrations/bigcommerce/callback`,
  };
}

export function hasBigCommerceConfig(): boolean {
  return Boolean(
    process.env.BIGCOMMERCE_CLIENT_ID &&
      process.env.BIGCOMMERCE_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function normalizeStoreHash(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? value;
  value = value.replace(/^store-/, "");
  value = value.replace(/\.mybigcommerce\.com$/, "");

  if (!/^[a-z0-9]+$/.test(value)) {
    throw new Error("Enter a valid BigCommerce store hash (e.g. abc123xyz).");
  }

  return value;
}

export function buildAuthorizeUrl(storeHash: string, state: string): string {
  const config = getBigCommerceConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: config.scopes,
    context: `stores/${storeHash}`,
    state,
  });
  return `https://login.bigcommerce.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeBigCommerceCode(
  code: string,
  scope: string,
  context: string,
): Promise<{ accessToken: string; scope: string; storeHash: string }> {
  const config = getBigCommerceConfig();
  const response = await fetch("https://login.bigcommerce.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
      code,
      scope,
      context,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BigCommerce token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    scope?: string;
    context?: string;
  };

  if (!body.access_token) {
    throw new Error("BigCommerce token exchange returned no access_token");
  }

  const storeHash = (body.context ?? context).replace(/^stores\//, "");
  if (!storeHash) {
    throw new Error("BigCommerce token exchange returned no store context");
  }

  return {
    accessToken: body.access_token,
    scope: body.scope ?? scope ?? config.scopes,
    storeHash,
  };
}

export { STATE_COOKIE };
