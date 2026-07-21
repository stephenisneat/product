import type { CanonicalProduct } from "@/domain";
import type { RemoteProductSummary } from "../../types";
import { mapBigCommerceProduct } from "./map";
import type {
  BigCommerceCategory,
  BigCommerceProduct,
} from "./types";

export type { BigCommerceProduct };

type BigCommerceListResponse<T> = {
  data: T[];
  meta?: {
    pagination?: {
      total_pages?: number;
      current_page?: number;
    };
  };
};

type BigCommerceItemResponse<T> = {
  data: T;
};

async function bigCommerceFetch<T>(
  storeHash: string,
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const url = new URL(
    `https://api.bigcommerce.com/stores/${storeHash}/v3${path}`,
  );
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Auth-Token": accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BigCommerce API HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function listBigCommerceProducts(
  accessToken: string,
  storeHash: string,
): Promise<RemoteProductSummary[]> {
  const summaries: RemoteProductSummary[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const body = await bigCommerceFetch<BigCommerceListResponse<BigCommerceProduct>>(
      storeHash,
      accessToken,
      "/catalog/products",
      {
        limit: "50",
        page: String(page),
        include: "images,variants",
      },
    );

    for (const product of body.data) {
      summaries.push({
        id: String(product.id),
        title: product.name,
        handle:
          product.custom_url?.url?.replace(/^\/|\/$/g, "") ||
          String(product.id),
        status: product.is_visible === false ? "draft" : "active",
        imageUrl:
          product.images?.find((image) => image.is_thumbnail)?.url_standard ||
          product.images?.[0]?.url_standard,
        variantCount: Math.max(product.variants?.length ?? 0, 1),
      });
    }

    totalPages = body.meta?.pagination?.total_pages ?? page;
    page += 1;
  }

  return summaries;
}

async function fetchCategories(
  accessToken: string,
  storeHash: string,
  categoryIds: number[],
): Promise<BigCommerceCategory[]> {
  if (categoryIds.length === 0) return [];
  const unique = Array.from(new Set(categoryIds));
  const body = await bigCommerceFetch<BigCommerceListResponse<BigCommerceCategory>>(
    storeHash,
    accessToken,
    "/catalog/categories",
    {
      "id:in": unique.join(","),
      limit: "250",
    },
  );
  return body.data;
}

export async function fetchBigCommerceProductsByIds(
  accessToken: string,
  storeHash: string,
  productIds: string[],
  currency = "USD",
): Promise<CanonicalProduct[]> {
  if (productIds.length === 0) return [];
  const results: CanonicalProduct[] = [];

  for (const id of productIds) {
    const body = await bigCommerceFetch<BigCommerceItemResponse<BigCommerceProduct>>(
      storeHash,
      accessToken,
      `/catalog/products/${id}`,
      { include: "images,variants" },
    );
    const categories = await fetchCategories(
      accessToken,
      storeHash,
      body.data.categories ?? [],
    );
    results.push(mapBigCommerceProduct(body.data, categories, currency));
  }

  return results;
}

export async function getBigCommerceCurrency(
  accessToken: string,
  storeHash: string,
): Promise<string> {
  try {
    const body = await bigCommerceFetch<{
      data?: { currency_code?: string; transactional_currency_code?: string };
    }>(storeHash, accessToken, "/store");
    // v2 store resource is under /v2 — try v3 fallback then v2
    if (body.data?.currency_code) return body.data.currency_code;
    if (body.data?.transactional_currency_code) {
      return body.data.transactional_currency_code;
    }
  } catch {
    // fall through to v2
  }

  try {
    const response = await fetch(
      `https://api.bigcommerce.com/stores/${storeHash}/v2/store`,
      {
        headers: {
          Accept: "application/json",
          "X-Auth-Token": accessToken,
        },
      },
    );
    if (!response.ok) return "USD";
    const store = (await response.json()) as { currency?: string };
    return store.currency || "USD";
  } catch {
    return "USD";
  }
}
