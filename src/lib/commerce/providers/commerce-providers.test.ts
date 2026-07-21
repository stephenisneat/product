import { describe, expect, it } from "vitest";
import {
  mapWooCommerceProduct,
  normalizeStoreUrl,
  storeDomainFromUrl,
} from "@/lib/commerce/providers/woocommerce";
import type { WooCommerceProduct } from "@/lib/commerce/providers/woocommerce/types";
import {
  mapBigCommerceProduct,
  normalizeStoreHash,
} from "@/lib/commerce/providers/bigcommerce";
import type { BigCommerceProduct } from "@/lib/commerce/providers/bigcommerce/types";
import {
  mapAmazonListing,
  normalizeMarketplaceId,
} from "@/lib/commerce/providers/amazon";
import type { AmazonListingItem } from "@/lib/commerce/providers/amazon/types";
import {
  mapSquarespaceProduct,
  normalizeSiteId,
} from "@/lib/commerce/providers/squarespace";
import type { SquarespaceProduct } from "@/lib/commerce/providers/squarespace/types";

describe("woocommerce mapper", () => {
  it("normalizes store URLs", () => {
    expect(normalizeStoreUrl("Shop.Example.com")).toBe("https://shop.example.com");
    expect(normalizeStoreUrl("https://shop.example.com/path")).toBe(
      "https://shop.example.com",
    );
    expect(storeDomainFromUrl("https://shop.example.com")).toBe("shop.example.com");
    expect(() => normalizeStoreUrl("")).toThrow();
  });

  it("maps a simple WooCommerce product", () => {
    const product: WooCommerceProduct = {
      id: 10,
      name: "Canvas Tote",
      slug: "canvas-tote",
      status: "publish",
      description: "<p>Carry everything.&nbsp;</p>",
      images: [{ id: 1, src: "https://example.com/tote.jpg" }],
      categories: [{ id: 3, name: "Bags", slug: "bags" }],
      attributes: [],
      variations: [],
      sku: "TOTE-1",
      price: "32.00",
      regular_price: "32.00",
      sale_price: "",
      stock_quantity: 8,
      manage_stock: true,
      type: "simple",
    };

    const canonical = mapWooCommerceProduct(product, [], "USD");
    expect(canonical.sourceProvider).toBe("woocommerce");
    expect(canonical.sourceProductId).toBe("10");
    expect(canonical.status).toBe("active");
    expect(canonical.description).toContain("Carry everything");
    expect(canonical.variants).toHaveLength(1);
    expect(canonical.variants[0]?.sku).toBe("TOTE-1");
    expect(canonical.collections[0]?.title).toBe("Bags");
  });
});

describe("bigcommerce mapper", () => {
  it("normalizes store hashes", () => {
    expect(normalizeStoreHash("AbC123")).toBe("abc123");
    expect(normalizeStoreHash("store-abc123.mybigcommerce.com")).toBe("abc123");
    expect(() => normalizeStoreHash("bad hash")).toThrow();
  });

  it("maps a BigCommerce product with variants", () => {
    const product: BigCommerceProduct = {
      id: 55,
      name: "Trail Runner",
      type: "physical",
      sku: "TR-BASE",
      description: "<p>Lightweight trail shoe</p>",
      price: 120,
      sale_price: 99,
      is_visible: true,
      inventory_tracking: "product",
      inventory_level: 4,
      categories: [9],
      images: [
        {
          id: 1,
          url_standard: "https://cdn11.bigcommerce.com/trail.jpg",
          is_thumbnail: true,
        },
      ],
      custom_url: { url: "/trail-runner/" },
      variants: [
        {
          id: 100,
          product_id: 55,
          sku: "TR-10",
          price: 120,
          sale_price: 99,
          inventory_level: 2,
          option_values: [
            { id: 1, label: "10", option_display_name: "Size" },
          ],
        },
      ],
    };

    const canonical = mapBigCommerceProduct(
      product,
      [{ id: 9, name: "Footwear", custom_url: { url: "/footwear/" } }],
      "USD",
    );
    expect(canonical.sourceProvider).toBe("bigcommerce");
    expect(canonical.handle).toBe("trail-runner");
    expect(canonical.variants).toHaveLength(1);
    expect(canonical.variants[0]?.optionValues).toEqual({ Size: "10" });
    expect(canonical.collections[0]?.title).toBe("Footwear");
  });
});

describe("amazon mapper", () => {
  it("normalizes marketplace ids", () => {
    expect(normalizeMarketplaceId("")).toBe("ATVPDKIKX0DER");
    expect(normalizeMarketplaceId("a2euq1wt0cs32")).toBe("A2EUQ1WT0CS32");
    expect(() => normalizeMarketplaceId("bad id")).toThrow();
  });

  it("maps an Amazon listing item", () => {
    const item: AmazonListingItem = {
      sku: "BOTTLE-750",
      summaries: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          asin: "B00EXAMPLE",
          productType: "HOME",
          status: ["BUYABLE"],
          itemName: "Insulated Bottle",
          mainImage: { link: "https://m.media-amazon.com/images/I/bottle.jpg" },
        },
      ],
      attributes: {
        product_description: [{ value: "Keeps drinks cold." }],
      },
      offers: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          price: { currencyCode: "USD", amount: 28 },
        },
      ],
      fulfillmentAvailability: [{ quantity: 15 }],
    };

    const canonical = mapAmazonListing(item, "USD");
    expect(canonical.sourceProvider).toBe("amazon");
    expect(canonical.sourceProductId).toBe("B00EXAMPLE");
    expect(canonical.status).toBe("active");
    expect(canonical.variants[0]?.sku).toBe("BOTTLE-750");
    expect(canonical.variants[0]?.price).toBe(28);
    expect(canonical.collections[0]?.title).toBe("HOME");
  });
});

describe("squarespace mapper", () => {
  it("normalizes site ids", () => {
    expect(normalizeSiteId("Example.COM")).toBe("example.com");
    expect(normalizeSiteId("https://mysite.squarespace.com")).toBe("mysite");
    expect(() => normalizeSiteId("bad id")).toThrow();
  });

  it("maps a Squarespace product", () => {
    const product: SquarespaceProduct = {
      id: "prod_1",
      name: "Ceramic Mug",
      description: "<p>Hand-thrown mug</p>",
      urlSlug: "ceramic-mug",
      isVisible: true,
      tags: ["Drinkware"],
      images: [{ url: "https://images.squarespace-cdn.com/mug.jpg" }],
      variantAttributes: ["Color"],
      variants: [
        {
          id: "var_1",
          sku: "MUG-WHT",
          pricing: {
            basePrice: { currency: "USD", value: "24.00" },
            onSale: false,
          },
          stock: { quantity: 6, unlimited: false },
          attributes: { Color: "White" },
        },
      ],
    };

    const canonical = mapSquarespaceProduct(product, "USD");
    expect(canonical.sourceProvider).toBe("squarespace");
    expect(canonical.handle).toBe("ceramic-mug");
    expect(canonical.variants).toHaveLength(1);
    expect(canonical.variants[0]?.optionValues).toEqual({ Color: "White" });
    expect(canonical.collections[0]?.title).toBe("Drinkware");
  });
});
