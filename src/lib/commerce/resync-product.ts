import type { Product } from "@/domain";
import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import {
  fetchAmazonProductsByIds,
  getAmazonCurrency,
} from "@/lib/commerce/providers/amazon";
import {
  fetchBigCommerceProductsByIds,
  getBigCommerceCurrency,
} from "@/lib/commerce/providers/bigcommerce";
import {
  fetchShopifyProductsByIds,
  getShopCurrency,
} from "@/lib/commerce/providers/shopify";
import {
  fetchSquarespaceProductsByIds,
  getSquarespaceCurrency,
} from "@/lib/commerce/providers/squarespace";
import {
  fetchWooCommerceProductsByIds,
  getWooCommerceCurrency,
} from "@/lib/commerce/providers/woocommerce";
import type { ProductRepository } from "@/repositories/types";

export async function resyncImportedProduct(
  products: ProductRepository,
  product: Product,
): Promise<Product> {
  if (!product.sourceProvider || !product.sourceProductId) {
    throw new Error("This product was not imported from a commerce provider.");
  }

  const connection = await products.getConnection(
    product.workspaceId,
    product.sourceProvider,
  );
  if (!connection) {
    throw new Error(
      `No active ${product.sourceProvider} connection. Connect a store first.`,
    );
  }

  const accessToken = decryptSecret(connection.accessToken);
  const sourceIds = [product.sourceProductId];

  switch (product.sourceProvider) {
    case "shopify": {
      const currency = await getShopCurrency(
        accessToken,
        connection.shopDomain,
      );
      const canonical = await fetchShopifyProductsByIds(
        accessToken,
        connection.shopDomain,
        sourceIds,
        currency,
      );
      if (canonical.length === 0) {
        throw new Error("Source product was not found in Shopify.");
      }
      return products.upsertImportedProduct(canonical[0]!, product.workspaceId);
    }
    case "woocommerce": {
      const currency = await getWooCommerceCurrency(
        accessToken,
        connection.shopDomain,
      );
      const canonical = await fetchWooCommerceProductsByIds(
        accessToken,
        connection.shopDomain,
        sourceIds,
        currency,
      );
      if (canonical.length === 0) {
        throw new Error("Source product was not found in WooCommerce.");
      }
      return products.upsertImportedProduct(canonical[0]!, product.workspaceId);
    }
    case "bigcommerce": {
      const currency = await getBigCommerceCurrency(
        accessToken,
        connection.shopDomain,
      );
      const canonical = await fetchBigCommerceProductsByIds(
        accessToken,
        connection.shopDomain,
        sourceIds,
        currency,
      );
      if (canonical.length === 0) {
        throw new Error("Source product was not found in BigCommerce.");
      }
      return products.upsertImportedProduct(canonical[0]!, product.workspaceId);
    }
    case "amazon": {
      const currency = await getAmazonCurrency();
      const fetched = await fetchAmazonProductsByIds(
        accessToken,
        connection.shopDomain,
        sourceIds,
        undefined,
        currency,
      );
      if (fetched.encodedPayload !== accessToken) {
        await products.upsertConnection({
          ...connection,
          accessToken: encryptSecret(fetched.encodedPayload),
          updatedAt: new Date().toISOString(),
        });
      }
      if (fetched.products.length === 0) {
        throw new Error("Source product was not found in Amazon.");
      }
      return products.upsertImportedProduct(
        fetched.products[0]!,
        product.workspaceId,
      );
    }
    case "squarespace": {
      const currencyResult = await getSquarespaceCurrency(accessToken);
      const fetched = await fetchSquarespaceProductsByIds(
        currencyResult.encodedPayload,
        connection.shopDomain,
        sourceIds,
        currencyResult.currency,
      );
      if (fetched.encodedPayload !== accessToken) {
        await products.upsertConnection({
          ...connection,
          accessToken: encryptSecret(fetched.encodedPayload),
          updatedAt: new Date().toISOString(),
        });
      }
      if (fetched.products.length === 0) {
        throw new Error("Source product was not found in Squarespace.");
      }
      return products.upsertImportedProduct(
        fetched.products[0]!,
        product.workspaceId,
      );
    }
    default:
      throw new Error(`Unsupported commerce provider: ${product.sourceProvider}`);
  }
}
