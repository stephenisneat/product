import type { CanonicalProduct } from "@/domain";
import { mapShopifyProduct } from "./map";
import type { ShopifyRemoteProductSummary } from "../../types";
import type { ShopifyGraphQLProduct } from "./types";

const API_VERSION = "2025-01";

export type { ShopifyGraphQLProduct };

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify GraphQL HTTP ${response.status}: ${text}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }
  if (!body.data) {
    throw new Error("Shopify GraphQL returned no data");
  }
  return body.data;
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  descriptionHtml
  featuredImage { url }
  images(first: 20) { nodes { url } }
  options { name position }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      barcode
      price
      compareAtPrice
      inventoryQuantity
      inventoryItem { tracked }
      selectedOptions { name value }
      image { url }
    }
  }
  collections(first: 20) {
    nodes { id title handle }
  }
`;

type ListProductsResult = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string;
      title: string;
      handle: string;
      status: string;
      featuredImage?: { url: string } | null;
      variantsCount?: { count: number } | null;
    }[];
  };
};

export async function listShopifyProducts(
  accessToken: string,
  shopDomain: string,
): Promise<ShopifyRemoteProductSummary[]> {
  const summaries: ShopifyRemoteProductSummary[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: ListProductsResult = await shopifyGraphql<ListProductsResult>(
      shopDomain,
      accessToken,
      `
      query ListProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            featuredImage { url }
            variantsCount { count }
          }
        }
      }
      `,
      { cursor },
    );

    for (const node of data.products.nodes) {
      summaries.push({
        id: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
        imageUrl: node.featuredImage?.url,
        variantCount: node.variantsCount?.count ?? 0,
      });
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return summaries;
}

export async function fetchShopifyProductsByIds(
  accessToken: string,
  shopDomain: string,
  productIds: string[],
  currency = "USD",
): Promise<CanonicalProduct[]> {
  if (productIds.length === 0) return [];

  const results: CanonicalProduct[] = [];

  // Shopify nodes query accepts up to ~250 ids; batch for safety.
  const batchSize = 25;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const data = await shopifyGraphql<{
      nodes: (ShopifyGraphQLProduct | null)[];
    }>(
      shopDomain,
      accessToken,
      `
      query ProductsByIds($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            ${PRODUCT_FIELDS}
          }
        }
      }
      `,
      { ids: batch },
    );

    for (const node of data.nodes) {
      if (node?.id) {
        results.push(mapShopifyProduct(node, currency));
      }
    }
  }

  return results;
}

export async function getShopCurrency(
  accessToken: string,
  shopDomain: string,
): Promise<string> {
  try {
    const data = await shopifyGraphql<{
      shop: { currencyCode: string };
    }>(
      shopDomain,
      accessToken,
      `query { shop { currencyCode } }`,
    );
    return data.shop.currencyCode || "USD";
  } catch {
    return "USD";
  }
}
