import type { CanonicalProduct, ProductStatus } from "@/domain";
import { canonicalProductSchema } from "@/domain";
import { stripHtml } from "@/lib/commerce/html";
import { slugify } from "@/lib/products/slugify";
import type {
  BigCommerceCategory,
  BigCommerceProduct,
  BigCommerceVariant,
} from "./types";

export { stripHtml };

function mapStatus(product: BigCommerceProduct): ProductStatus {
  if (product.is_visible === false) return "draft";
  if (product.availability === "disabled") return "archived";
  return "active";
}

function handleFromProduct(product: BigCommerceProduct): string {
  const url = product.custom_url?.url?.replace(/^\/|\/$/g, "");
  if (url) return slugify(url.split("/").pop() || url);
  return slugify(product.name);
}

export function mapBigCommerceProduct(
  product: BigCommerceProduct,
  categories: BigCommerceCategory[] = [],
  currency = "USD",
): CanonicalProduct {
  const images = (product.images ?? [])
    .map((image) => image.url_zoom || image.url_standard)
    .filter((url): url is string => Boolean(url));

  const thumbnail = (product.images ?? []).find((image) => image.is_thumbnail);
  const thumbUrl = thumbnail?.url_zoom || thumbnail?.url_standard;
  if (thumbUrl && !images.includes(thumbUrl)) {
    images.unshift(thumbUrl);
  }

  const remoteVariants: BigCommerceVariant[] = product.variants ?? [];
  const optionNames = new Set<string>();
  for (const variant of remoteVariants) {
    for (const option of variant.option_values ?? []) {
      optionNames.add(option.option_display_name);
    }
  }

  const options = Array.from(optionNames).map((name, index) => ({
    name,
    position: index,
  }));

  const tracked = product.inventory_tracking !== "none";

  let variants;
  if (remoteVariants.length > 0) {
    variants = remoteVariants.map((variant, index) => {
      const optionValues: Record<string, string> = {};
      for (const option of variant.option_values ?? []) {
        optionValues[option.option_display_name] = option.label;
      }
      const sale = variant.sale_price ?? null;
      const price = sale ?? variant.price ?? product.price ?? 0;
      const compare =
        sale != null && variant.price != null && variant.price > sale
          ? variant.price
          : variant.retail_price ?? undefined;

      return {
        sourceVariantId: String(variant.id),
        title:
          Object.values(optionValues).join(" / ") ||
          variant.sku ||
          `Variant ${index + 1}`,
        sku: variant.sku || undefined,
        price: Number(price) || 0,
        compareAtPrice: compare != null ? Number(compare) : undefined,
        currency,
        optionValues,
        position: index,
        imageUrl: variant.image_url || undefined,
        inventoryQuantity: variant.inventory_level ?? 0,
        inventoryTracked: tracked,
      };
    });
  } else {
    const sale = product.sale_price;
    const price = sale ?? product.price ?? 0;
    variants = [
      {
        sourceVariantId: String(product.id),
        title: "Default Title",
        sku: product.sku || undefined,
        price: Number(price) || 0,
        compareAtPrice:
          sale != null && product.price != null && product.price > sale
            ? product.price
            : product.retail_price,
        currency,
        optionValues: {},
        position: 0,
        imageUrl: images[0],
        inventoryQuantity: product.inventory_level ?? 0,
        inventoryTracked: tracked,
      },
    ];
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const collections = (product.categories ?? [])
    .map((categoryId) => categoryById.get(categoryId))
    .filter((category): category is BigCommerceCategory => Boolean(category))
    .map((category) => ({
      sourceCollectionId: String(category.id),
      title: category.name,
      handle: slugify(
        category.custom_url?.url?.replace(/^\/|\/$/g, "") || category.name,
      ),
    }));

  return canonicalProductSchema.parse({
    sourceProvider: "bigcommerce",
    sourceProductId: String(product.id),
    title: product.name,
    handle: handleFromProduct(product),
    description: stripHtml(product.description ?? ""),
    status: mapStatus(product),
    images,
    options,
    variants,
    collections,
  });
}
