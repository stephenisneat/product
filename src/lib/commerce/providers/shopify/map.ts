import type { CanonicalProduct, ProductStatus } from "@/domain";
import { canonicalProductSchema } from "@/domain";
import type { ShopifyGraphQLProduct } from "./types";

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapStatus(status: string): ProductStatus {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

function parseMoney(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapShopifyProduct(
  product: ShopifyGraphQLProduct,
  currency = "USD",
): CanonicalProduct {
  const images = product.images.nodes
    .map((image) => image.url)
    .filter(Boolean);
  if (product.featuredImage?.url && !images.includes(product.featuredImage.url)) {
    images.unshift(product.featuredImage.url);
  }

  const options = [...product.options]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      name: option.name,
      position: option.position,
    }));

  const variants = product.variants.nodes.map((variant, index) => {
    const optionValues: Record<string, string> = {};
    for (const option of variant.selectedOptions) {
      optionValues[option.name] = option.value;
    }

    return {
      sourceVariantId: variant.id,
      title: variant.title || "Default Title",
      sku: variant.sku || undefined,
      barcode: variant.barcode || undefined,
      price: parseMoney(variant.price),
      compareAtPrice:
        variant.compareAtPrice != null
          ? parseMoney(variant.compareAtPrice)
          : undefined,
      currency,
      optionValues,
      position: index,
      imageUrl: variant.image?.url || undefined,
      inventoryQuantity: variant.inventoryQuantity ?? 0,
      inventoryTracked: variant.inventoryItem?.tracked ?? true,
    };
  });

  const collections = product.collections.nodes.map((collection) => ({
    sourceCollectionId: collection.id,
    title: collection.title,
    handle: collection.handle,
  }));

  return canonicalProductSchema.parse({
    sourceProvider: "shopify",
    sourceProductId: product.id,
    title: product.title,
    handle: product.handle,
    description: stripHtml(product.descriptionHtml ?? ""),
    status: mapStatus(product.status),
    images,
    options,
    variants,
    collections,
  });
}
