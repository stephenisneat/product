import type { CanonicalProduct, ProductStatus } from "@/domain";
import { canonicalProductSchema } from "@/domain";
import { stripHtml } from "@/lib/commerce/html";
import { slugify } from "@/lib/products/slugify";
import type { AmazonListingItem } from "./types";

export { stripHtml };

function attributeValue(
  attributes: AmazonListingItem["attributes"],
  key: string,
): string | number | boolean | undefined {
  const values = attributes?.[key];
  return values?.[0]?.value;
}

function mapStatus(statuses: string[] | undefined): ProductStatus {
  if (!statuses?.length) return "draft";
  const upper = statuses.map((status) => status.toUpperCase());
  if (upper.includes("BUYABLE") || upper.includes("DISCOVERABLE")) {
    return "active";
  }
  if (upper.includes("DELETED")) return "archived";
  return "draft";
}

export function mapAmazonListing(
  item: AmazonListingItem,
  currency = "USD",
): CanonicalProduct {
  const summary = item.summaries?.[0];
  const title =
    summary?.itemName ||
    String(attributeValue(item.attributes, "item_name") ?? item.sku);
  const description = String(
    attributeValue(item.attributes, "product_description") ??
      attributeValue(item.attributes, "bullet_point") ??
      "",
  );
  const images: string[] = [];
  if (summary?.mainImage?.link) images.push(summary.mainImage.link);
  const extraImage = attributeValue(item.attributes, "main_product_image_locator");
  if (typeof extraImage === "string" && extraImage.startsWith("http")) {
    if (!images.includes(extraImage)) images.push(extraImage);
  }

  const offer = item.offers?.[0];
  const amount = offer?.price?.amount;
  const price =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number.parseFloat(amount) || 0
        : Number(attributeValue(item.attributes, "list_price") ?? 0) || 0;
  const offerCurrency = offer?.price?.currencyCode || currency;
  const quantity =
    item.fulfillmentAvailability?.reduce(
      (sum, entry) => sum + (entry.quantity ?? 0),
      0,
    ) ?? 0;

  const asin = summary?.asin;
  const sourceProductId = asin || item.sku;

  return canonicalProductSchema.parse({
    sourceProvider: "amazon",
    sourceProductId,
    title,
    handle: slugify(asin || item.sku || title),
    description: stripHtml(description),
    status: mapStatus(summary?.status),
    images,
    options: [],
    variants: [
      {
        sourceVariantId: item.sku,
        title: "Default Title",
        sku: item.sku,
        barcode: asin || undefined,
        price,
        currency: offerCurrency,
        optionValues: {},
        position: 0,
        imageUrl: images[0],
        inventoryQuantity: quantity,
        inventoryTracked: true,
      },
    ],
    collections: summary?.productType
      ? [
          {
            sourceCollectionId: summary.productType,
            title: summary.productType,
            handle: slugify(summary.productType),
          },
        ]
      : [],
  });
}
