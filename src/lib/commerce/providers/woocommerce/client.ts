import type { CanonicalProduct } from "@/domain";
import type { RemoteProductSummary } from "../../types";
import { mapWooCommerceProduct } from "./map";
import {
  decodeCredentials,
  type WooCommerceCredentials,
} from "./oauth";
import type { WooCommerceProduct, WooCommerceVariation } from "./types";

export type { WooCommerceProduct };

async function wooFetch<T>(
  storeUrl: string,
  credentials: WooCommerceCredentials,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const auth = Buffer.from(
    `${credentials.consumerKey}:${credentials.consumerSecret}`,
  ).toString("base64");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function verifyWooCommerceCredentials(
  storeUrl: string,
  credentials: WooCommerceCredentials,
): Promise<void> {
  await wooFetch(storeUrl, credentials, "/products", {
    per_page: "1",
    status: "any",
  });
}

export async function listWooCommerceProducts(
  accessToken: string,
  storeUrl: string,
): Promise<RemoteProductSummary[]> {
  const credentials = decodeCredentials(accessToken);
  const summaries: RemoteProductSummary[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const products = await wooFetch<WooCommerceProduct[]>(
      storeUrl,
      credentials,
      "/products",
      {
        per_page: "50",
        page: String(page),
        status: "any",
      },
    );

    for (const product of products) {
      summaries.push({
        id: String(product.id),
        title: product.name,
        handle: product.slug,
        status: product.status,
        imageUrl: product.images[0]?.src,
        variantCount:
          product.type === "variable"
            ? Math.max(product.variations?.length ?? 0, 1)
            : 1,
      });
    }

    hasMore = products.length === 50;
    page += 1;
  }

  return summaries;
}

export async function fetchWooCommerceProductsByIds(
  accessToken: string,
  storeUrl: string,
  productIds: string[],
  currency = "USD",
): Promise<CanonicalProduct[]> {
  if (productIds.length === 0) return [];
  const credentials = decodeCredentials(accessToken);
  const results: CanonicalProduct[] = [];

  for (const id of productIds) {
    const product = await wooFetch<WooCommerceProduct>(
      storeUrl,
      credentials,
      `/products/${id}`,
    );

    let variations: WooCommerceVariation[] = [];
    if (product.type === "variable" && (product.variations?.length ?? 0) > 0) {
      variations = await wooFetch<WooCommerceVariation[]>(
        storeUrl,
        credentials,
        `/products/${id}/variations`,
        { per_page: "100" },
      );
    }

    results.push(mapWooCommerceProduct(product, variations, currency));
  }

  return results;
}

export async function getWooCommerceCurrency(
  accessToken: string,
  storeUrl: string,
): Promise<string> {
  try {
    const credentials = decodeCredentials(accessToken);
    const settings = await wooFetch<
      { id?: string; value?: string }[]
    >(storeUrl, credentials, "/settings/general");
    const currencySetting = settings.find(
      (setting) => setting.id === "woocommerce_currency",
    );
    return currencySetting?.value || "USD";
  } catch {
    return "USD";
  }
}
