import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_SCOPES = "read_products,read_inventory";
const STATE_COOKIE = "shopify_oauth_state";

export function getShopifyConfig() {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const scopes = process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Shopify is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.",
    );
  }
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for Shopify OAuth redirects.");
  }

  return {
    apiKey,
    apiSecret,
    scopes,
    appUrl: appUrl.replace(/\/$/, ""),
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/integrations/shopify/callback`,
  };
}

export function hasShopifyConfig(): boolean {
  return Boolean(
    process.env.SHOPIFY_API_KEY &&
      process.env.SHOPIFY_API_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function normalizeShopDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? value;
  value = value.split("?")[0] ?? value;

  if (!value.includes(".")) {
    value = `${value}.myshopify.com`;
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) {
    throw new Error("Enter a valid Shopify store domain (e.g. my-store.myshopify.com).");
  }

  return value;
}

export function buildAuthorizeUrl(shop: string, state: string): string {
  const config = getShopifyConfig();
  const params = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes,
    redirect_uri: config.callbackUrl,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(
  query: Record<string, string>,
  apiSecret?: string,
): boolean {
  const secret = apiSecret ?? getShopifyConfig().apiSecret;
  const hmac = query.hmac;
  if (!hmac) return false;

  const message = Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature")
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");

  const digest = createHmac("sha256", secret).update(message).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export async function exchangeShopifyCode(
  shop: string,
  code: string,
): Promise<{ accessToken: string; scope: string }> {
  const config = getShopifyConfig();
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token exchange failed: ${text || response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };

  if (!body.access_token) {
    throw new Error("Shopify token exchange returned no access_token");
  }

  return {
    accessToken: body.access_token,
    scope: body.scope ?? config.scopes,
  };
}

export { STATE_COOKIE };
