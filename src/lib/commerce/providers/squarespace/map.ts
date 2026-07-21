import type { CanonicalProduct, ProductStatus } from "@/domain";
import { canonicalProductSchema } from "@/domain";
import { stripHtml } from "@/lib/commerce/html";
import { slugify } from "@/lib/products/slugify";
import type { SquarespaceProduct, SquarespaceVariant } from "./types";

export { stripHtml };

function mapStatus(product: SquarespaceProduct): ProductStatus {
  return product.isVisible === false ? "draft" : "active";
}

function parseMoney(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapVariant(
  variant: SquarespaceVariant,
  index: number,
  fallbackCurrency: string,
) {
  const base = parseMoney(variant.pricing?.basePrice?.value);
  const sale = parseMoney(variant.pricing?.salePrice?.value);
  const onSale = variant.pricing?.onSale && sale > 0;
  const currency =
    variant.pricing?.basePrice?.currency ||
    variant.pricing?.salePrice?.currency ||
    fallbackCurrency;

  return {
    sourceVariantId: variant.id,
    title:
      Object.values(variant.attributes ?? {}).join(" / ") ||
      variant.sku ||
      `Variant ${index + 1}`,
    sku: variant.sku || undefined,
    price: onSale ? sale : base,
    compareAtPrice: onSale && base > sale ? base : undefined,
    currency,
    optionValues: variant.attributes ?? {},
    position: index,
    imageUrl: variant.image?.url || undefined,
    inventoryQuantity: variant.stock?.unlimited
      ? 0
      : (variant.stock?.quantity ?? 0),
    inventoryTracked: !variant.stock?.unlimited,
  };
}

export function mapSquarespaceProduct(
  product: SquarespaceProduct,
  currency = "USD",
): CanonicalProduct {
  const images = (product.images ?? [])
    .map((image) => image.url)
    .filter((url): url is string => Boolean(url));

  const options = (product.variantAttributes ?? []).map((name, index) => ({
    name,
    position: index,
  }));

  const remoteVariants = product.variants ?? [];
  const variants =
    remoteVariants.length > 0
      ? remoteVariants.map((variant, index) =>
          mapVariant(variant, index, currency),
        )
      : [
          {
            sourceVariantId: product.id,
            title: "Default Title",
            price: 0,
            currency,
            optionValues: {},
            position: 0,
            imageUrl: images[0],
            inventoryQuantity: 0,
            inventoryTracked: true,
          },
        ];

  const collections = (product.tags ?? []).map((tag) => ({
    sourceCollectionId: tag,
    title: tag,
    handle: slugify(tag),
  }));

  return canonicalProductSchema.parse({
    sourceProvider: "squarespace",
    sourceProductId: product.id,
    title: product.name,
    handle: product.urlSlug || slugify(product.name),
    description: stripHtml(product.description ?? ""),
    status: mapStatus(product),
    images,
    options,
    variants,
    collections,
  });
}
