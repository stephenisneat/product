import type { CanonicalProduct } from "@/domain";
import type { RemoteProductSummary } from "../../types";
import { mapAmazonListing } from "./map";
import {
  decodeTokenPayload,
  encodeTokenPayload,
  getAmazonConfig,
  refreshAmazonToken,
  type AmazonTokenPayload,
} from "./oauth";
import type { AmazonListingItem, AmazonListingsSearchResult } from "./types";

export type { AmazonListingItem };

async function ensureAccessToken(
  payload: AmazonTokenPayload,
): Promise<{ payload: AmazonTokenPayload; refreshed: boolean }> {
  if (payload.expiresAt > Date.now() + 60_000) {
    return { payload, refreshed: false };
  }
  const refreshed = await refreshAmazonToken(payload.refreshToken);
  return {
    payload: {
      ...refreshed,
      sellerId: payload.sellerId ?? refreshed.sellerId,
    },
    refreshed: true,
  };
}

async function spApiFetch<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const config = getAmazonConfig();
  const url = new URL(`${config.spApiEndpoint}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "x-amz-access-token": accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amazon SP-API HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function listAmazonProducts(
  accessTokenPayload: string,
  _shopDomain: string,
  sellerId?: string,
): Promise<{
  products: RemoteProductSummary[];
  encodedPayload: string;
}> {
  let payload = decodeTokenPayload(accessTokenPayload);
  const ensured = await ensureAccessToken(payload);
  payload = ensured.payload;

  const seller = sellerId || payload.sellerId;
  if (!seller) {
    throw new Error(
      "Amazon seller ID is required. Reconnect and provide your Seller ID.",
    );
  }

  const marketplaceId = getAmazonConfig().marketplaceId;
  const summaries: RemoteProductSummary[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      marketplaceIds: marketplaceId,
      pageSize: "20",
    };
    if (pageToken) params.pageToken = pageToken;

    const body = await spApiFetch<AmazonListingsSearchResult>(
      payload.accessToken,
      `/listings/2021-08-01/items/${encodeURIComponent(seller)}`,
      params,
    );

    for (const item of body.items ?? []) {
      const summary = item.summaries?.[0];
      summaries.push({
        id: summary?.asin || item.sku,
        title: summary?.itemName || item.sku,
        handle: summary?.asin || item.sku,
        status: summary?.status?.[0] || "UNKNOWN",
        imageUrl: summary?.mainImage?.link,
        variantCount: 1,
      });
    }

    pageToken = body.pagination?.nextToken;
  } while (pageToken);

  payload = { ...payload, sellerId: seller };
  return {
    products: summaries,
    encodedPayload: encodeTokenPayload(payload),
  };
}

export async function fetchAmazonProductsByIds(
  accessTokenPayload: string,
  _shopDomain: string,
  productIds: string[],
  sellerId?: string,
  currency = "USD",
): Promise<{
  products: CanonicalProduct[];
  encodedPayload: string;
}> {
  if (productIds.length === 0) {
    return { products: [], encodedPayload: accessTokenPayload };
  }

  let payload = decodeTokenPayload(accessTokenPayload);
  const ensured = await ensureAccessToken(payload);
  payload = ensured.payload;

  const seller = sellerId || payload.sellerId;
  if (!seller) {
    throw new Error(
      "Amazon seller ID is required. Reconnect and provide your Seller ID.",
    );
  }

  const marketplaceId = getAmazonConfig().marketplaceId;
  const results: CanonicalProduct[] = [];

  // Search listings and filter — SP-API getListingsItem is per SKU.
  // productIds may be ASIN or SKU; fetch by SKU when possible via search.
  const listed = await listAmazonProducts(
    encodeTokenPayload(payload),
    _shopDomain,
    seller,
  );
  payload = decodeTokenPayload(listed.encodedPayload);

  const wanted = new Set(productIds);
  const skusToFetch = new Set<string>();

  for (const summary of listed.products) {
    if (wanted.has(summary.id) || wanted.has(summary.handle)) {
      skusToFetch.add(summary.handle);
    }
  }
  for (const id of productIds) {
    skusToFetch.add(id);
  }

  for (const sku of skusToFetch) {
    try {
      const item = await spApiFetch<AmazonListingItem>(
        payload.accessToken,
        `/listings/2021-08-01/items/${encodeURIComponent(seller)}/${encodeURIComponent(sku)}`,
        {
          marketplaceIds: marketplaceId,
          includedData: "summaries,attributes,offers,fulfillmentAvailability",
        },
      );
      const canonical = mapAmazonListing(item, currency);
      if (
        wanted.has(canonical.sourceProductId) ||
        wanted.has(item.sku) ||
        wanted.has(sku)
      ) {
        results.push(canonical);
      }
    } catch {
      // Skip SKUs that are actually ASINs without a matching listing SKU.
    }
  }

  // Deduplicate by sourceProductId
  const byId = new Map(results.map((product) => [product.sourceProductId, product]));
  payload = { ...payload, sellerId: seller };

  return {
    products: Array.from(byId.values()),
    encodedPayload: encodeTokenPayload(payload),
  };
}

export async function getAmazonCurrency(): Promise<string> {
  return "USD";
}
