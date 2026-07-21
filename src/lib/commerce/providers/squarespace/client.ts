import type { CanonicalProduct } from "@/domain";
import type { RemoteProductSummary } from "../../types";
import { mapSquarespaceProduct } from "./map";
import {
  decodeTokenPayload,
  encodeTokenPayload,
  refreshSquarespaceToken,
  type SquarespaceTokenPayload,
} from "./oauth";
import type {
  SquarespaceProduct,
  SquarespaceProductsResponse,
} from "./types";

export type { SquarespaceProduct };

async function ensureAccessToken(
  payload: SquarespaceTokenPayload,
): Promise<SquarespaceTokenPayload> {
  if (
    !payload.refreshToken ||
    !payload.expiresAt ||
    payload.expiresAt > Date.now() + 60_000
  ) {
    return payload;
  }
  return refreshSquarespaceToken(payload.refreshToken);
}

async function squarespaceFetch<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://api.squarespace.com/1.0${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ProductAgent/1.0",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Squarespace API HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function listSquarespaceProducts(
  accessTokenPayload: string,
  siteId: string,
): Promise<{
  products: RemoteProductSummary[];
  encodedPayload: string;
}> {
  void siteId;
  const payload = await ensureAccessToken(decodeTokenPayload(accessTokenPayload));
  const summaries: RemoteProductSummary[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;

    const body = await squarespaceFetch<SquarespaceProductsResponse>(
      payload.accessToken,
      "/commerce/products",
      params,
    );

    for (const product of body.products ?? []) {
      summaries.push({
        id: product.id,
        title: product.name,
        handle: product.urlSlug || product.id,
        status: product.isVisible === false ? "draft" : "active",
        imageUrl: product.images?.[0]?.url,
        variantCount: Math.max(product.variants?.length ?? 0, 1),
      });
    }

    cursor = body.pagination?.hasNextPage
      ? (body.pagination.nextPageCursor ?? undefined)
      : undefined;
  } while (cursor);

  return {
    products: summaries,
    encodedPayload: encodeTokenPayload(payload),
  };
}

export async function fetchSquarespaceProductsByIds(
  accessTokenPayload: string,
  siteId: string,
  productIds: string[],
  currency = "USD",
): Promise<{
  products: CanonicalProduct[];
  encodedPayload: string;
}> {
  void siteId;
  if (productIds.length === 0) {
    return { products: [], encodedPayload: accessTokenPayload };
  }

  const payload = await ensureAccessToken(decodeTokenPayload(accessTokenPayload));
  const wanted = new Set(productIds);
  const results: CanonicalProduct[] = [];
  let cursor: string | undefined;

  // Squarespace product detail is available per-id; prefer direct fetch.
  for (const id of productIds) {
    try {
      const product = await squarespaceFetch<SquarespaceProduct>(
        payload.accessToken,
        `/commerce/products/${encodeURIComponent(id)}`,
      );
      results.push(mapSquarespaceProduct(product, currency));
      wanted.delete(id);
    } catch {
      // Fall through to list scan for remaining ids.
    }
  }

  while (wanted.size > 0) {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;
    const body = await squarespaceFetch<SquarespaceProductsResponse>(
      payload.accessToken,
      "/commerce/products",
      params,
    );

    for (const product of body.products ?? []) {
      if (wanted.has(product.id)) {
        results.push(mapSquarespaceProduct(product, currency));
        wanted.delete(product.id);
      }
    }

    if (!body.pagination?.hasNextPage || wanted.size === 0) break;
    cursor = body.pagination.nextPageCursor ?? undefined;
    if (!cursor) break;
  }

  return {
    products: results,
    encodedPayload: encodeTokenPayload(payload),
  };
}

export async function getSquarespaceCurrency(
  accessTokenPayload: string,
): Promise<{ currency: string; encodedPayload: string }> {
  try {
    const payload = await ensureAccessToken(
      decodeTokenPayload(accessTokenPayload),
    );
    // Infer from first product variant pricing when store settings aren't exposed.
    const body = await squarespaceFetch<SquarespaceProductsResponse>(
      payload.accessToken,
      "/commerce/products",
    );
    const currency =
      body.products?.[0]?.variants?.[0]?.pricing?.basePrice?.currency || "USD";
    return { currency, encodedPayload: encodeTokenPayload(payload) };
  } catch {
    return { currency: "USD", encodedPayload: accessTokenPayload };
  }
}
