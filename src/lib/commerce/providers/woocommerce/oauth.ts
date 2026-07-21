const STATE_COOKIE = "woocommerce_oauth_state";

export type WooCommerceCredentials = {
  consumerKey: string;
  consumerSecret: string;
};

export function getWooCommerceConfig() {
  // WooCommerce uses per-store API keys; app-level config is optional
  // (webhook secret / encryption). Presence of TOKEN_ENCRYPTION_KEY or
  // any commerce secret enables the connection UI.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return {
    appUrl: appUrl?.replace(/\/$/, "") ?? "",
  };
}

export function hasWooCommerceConfig(): boolean {
  return Boolean(
    process.env.TOKEN_ENCRYPTION_KEY ||
      process.env.SHOPIFY_API_SECRET ||
      process.env.WOOCOMMERCE_WEBHOOK_SECRET ||
      process.env.BIGCOMMERCE_CLIENT_SECRET ||
      process.env.AMAZON_LWA_CLIENT_SECRET ||
      process.env.SQUARESPACE_CLIENT_SECRET,
  );
}

export function normalizeStoreUrl(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) {
    throw new Error("Enter your WooCommerce store URL (e.g. https://shop.example.com).");
  }
  if (!/^https?:\/\//.test(value)) {
    value = `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid WooCommerce store URL (e.g. https://shop.example.com).");
  }

  if (!url.hostname || url.hostname.includes(" ")) {
    throw new Error("Enter a valid WooCommerce store URL (e.g. https://shop.example.com).");
  }

  return url.origin;
}

/** Store domain key used in commerce_connections.shop_domain */
export function storeDomainFromUrl(storeUrl: string): string {
  return new URL(storeUrl).host;
}

export function encodeCredentials(credentials: WooCommerceCredentials): string {
  return JSON.stringify(credentials);
}

export function decodeCredentials(payload: string): WooCommerceCredentials {
  const parsed = JSON.parse(payload) as Partial<WooCommerceCredentials>;
  if (!parsed.consumerKey || !parsed.consumerSecret) {
    throw new Error("Invalid WooCommerce credentials payload");
  }
  return {
    consumerKey: parsed.consumerKey,
    consumerSecret: parsed.consumerSecret,
  };
}

export { STATE_COOKIE };
