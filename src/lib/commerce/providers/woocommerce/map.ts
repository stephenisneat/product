import type { CanonicalProduct, ProductStatus } from "@/domain";
import { canonicalProductSchema } from "@/domain";
import { stripHtml } from "@/lib/commerce/html";
import { slugify } from "@/lib/products/slugify";
import type { WooCommerceProduct, WooCommerceVariation } from "./types";

export { stripHtml };

function mapStatus(status: string): ProductStatus {
  switch (status.toLowerCase()) {
    case "publish":
    case "published":
      return "active";
    case "private":
    case "trash":
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

export function mapWooCommerceProduct(
  product: WooCommerceProduct,
  variations: WooCommerceVariation[] = [],
  currency = "USD",
): CanonicalProduct {
  const images = product.images.map((image) => image.src).filter(Boolean);

  const options = [...(product.attributes ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((attribute) => attribute.options?.length)
    .map((attribute, index) => ({
      name: attribute.name,
      position: attribute.position ?? index,
    }));

  let variants;
  if (variations.length > 0) {
    variants = variations.map((variation, index) => {
      const optionValues: Record<string, string> = {};
      for (const attribute of variation.attributes) {
        optionValues[attribute.name] = attribute.option;
      }
      const sale = parseMoney(variation.sale_price);
      const regular = parseMoney(variation.regular_price || variation.price);
      return {
        sourceVariantId: String(variation.id),
        title:
          Object.values(optionValues).join(" / ") ||
          variation.sku ||
          `Variant ${index + 1}`,
        sku: variation.sku || undefined,
        price: sale > 0 ? sale : regular,
        compareAtPrice: sale > 0 && regular > sale ? regular : undefined,
        currency,
        optionValues,
        position: index,
        imageUrl: variation.image?.src || undefined,
        inventoryQuantity: variation.stock_quantity ?? 0,
        inventoryTracked: variation.manage_stock ?? false,
      };
    });
  } else {
    const sale = parseMoney(product.sale_price);
    const regular = parseMoney(product.regular_price || product.price);
    variants = [
      {
        sourceVariantId: String(product.id),
        title: "Default Title",
        sku: product.sku || undefined,
        price: sale > 0 ? sale : regular,
        compareAtPrice: sale > 0 && regular > sale ? regular : undefined,
        currency,
        optionValues: {},
        position: 0,
        imageUrl: images[0],
        inventoryQuantity: product.stock_quantity ?? 0,
        inventoryTracked: product.manage_stock ?? false,
      },
    ];
  }

  const collections = (product.categories ?? []).map((category) => ({
    sourceCollectionId: String(category.id),
    title: category.name,
    handle: category.slug || slugify(category.name),
  }));

  return canonicalProductSchema.parse({
    sourceProvider: "woocommerce",
    sourceProductId: String(product.id),
    title: product.name,
    handle: product.slug || slugify(product.name),
    description: stripHtml(product.description || product.short_description || ""),
    status: mapStatus(product.status),
    images,
    options,
    variants,
    collections,
  });
}
