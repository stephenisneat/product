import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  canonicalProductSchema,
  productSchema,
  productVariantSchema,
} from "@/domain";
import { encryptSecret, decryptSecret } from "@/lib/commerce/crypto";
import {
  mapShopifyProduct,
  normalizeShopDomain,
  stripHtml,
  verifyShopifyHmac,
} from "@/lib/commerce/providers/shopify";
import type { ShopifyGraphQLProduct } from "@/lib/commerce/providers/shopify/types";

const sampleShopifyProduct: ShopifyGraphQLProduct = {
  id: "gid://shopify/Product/123",
  title: "Aurora Insulated Bottle",
  handle: "aurora-insulated-bottle",
  status: "ACTIVE",
  descriptionHtml: "<p>A double-wall vacuum bottle.&nbsp;<br/>Built tough.</p>",
  featuredImage: {
    url: "https://cdn.shopify.com/s/files/1/aurora.jpg",
  },
  images: {
    nodes: [{ url: "https://cdn.shopify.com/s/files/1/aurora.jpg" }],
  },
  options: [
    { name: "Size", position: 1 },
    { name: "Color", position: 2 },
  ],
  variants: {
    nodes: [
      {
        id: "gid://shopify/ProductVariant/1",
        title: "750ml / Black",
        sku: "AUR-750-BLK",
        barcode: null,
        price: "48.00",
        compareAtPrice: "56.00",
        inventoryQuantity: 12,
        inventoryItem: { tracked: true },
        selectedOptions: [
          { name: "Size", value: "750ml" },
          { name: "Color", value: "Black" },
        ],
        image: { url: "https://cdn.shopify.com/s/files/1/aurora.jpg" },
      },
      {
        id: "gid://shopify/ProductVariant/2",
        title: "500ml / White",
        sku: "AUR-500-WHT",
        barcode: null,
        price: "42.00",
        compareAtPrice: null,
        inventoryQuantity: 4,
        inventoryItem: { tracked: true },
        selectedOptions: [
          { name: "Size", value: "500ml" },
          { name: "Color", value: "White" },
        ],
        image: null,
      },
    ],
  },
  collections: {
    nodes: [
      {
        id: "gid://shopify/Collection/9",
        title: "Drinkware",
        handle: "drinkware",
      },
    ],
  },
};

describe("canonical product schema", () => {
  it("parses a canonical import payload", () => {
    const parsed = canonicalProductSchema.parse({
      sourceProvider: "shopify",
      sourceProductId: "gid://shopify/Product/1",
      title: "Test",
      handle: "test",
      description: "",
      status: "active",
      images: ["https://cdn.shopify.com/s/files/1/x.jpg"],
      options: [{ name: "Size", position: 1 }],
      variants: [
        {
          sourceVariantId: "gid://shopify/ProductVariant/1",
          title: "Default Title",
          price: 10,
          currency: "USD",
          optionValues: {},
          position: 0,
          inventoryQuantity: 3,
          inventoryTracked: true,
        },
      ],
      collections: [],
    });
    expect(parsed.variants).toHaveLength(1);
  });

  it("parses product variants", () => {
    const variant = productVariantSchema.parse({
      id: "var_1",
      productId: "prod_1",
      title: "Default Title",
      price: 10,
      currency: "USD",
      optionValues: { Size: "M" },
      position: 0,
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    });
    expect(variant.optionValues.Size).toBe("M");
  });

  it("allows optional source fields on products", () => {
    const parsed = productSchema.parse({
      id: "prod_1",
      title: "Test",
      handle: "test",
      description: "",
      status: "draft",
      price: 0,
      currency: "USD",
      images: [],
      channels: ["shopify"],
      sourceProvider: "shopify",
      sourceProductId: "gid://shopify/Product/1",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      ownerId: "user_1",
    });
    expect(parsed.sourceProvider).toBe("shopify");
  });
});

describe("shopify mapper", () => {
  it("strips html from descriptions", () => {
    expect(stripHtml("<p>Hello&nbsp;world</p>")).toBe("Hello world");
  });

  it("maps a Shopify GraphQL product into canonical form", () => {
    const canonical = mapShopifyProduct(sampleShopifyProduct, "USD");
    expect(canonical.sourceProvider).toBe("shopify");
    expect(canonical.sourceProductId).toBe("gid://shopify/Product/123");
    expect(canonical.status).toBe("active");
    expect(canonical.description).toContain("double-wall");
    expect(canonical.options).toHaveLength(2);
    expect(canonical.variants).toHaveLength(2);
    expect(canonical.variants[0]?.sku).toBe("AUR-750-BLK");
    expect(canonical.variants[0]?.optionValues).toEqual({
      Size: "750ml",
      Color: "Black",
    });
    expect(canonical.variants[0]?.compareAtPrice).toBe(56);
    expect(canonical.collections[0]?.title).toBe("Drinkware");
  });

  it("normalizes shop domains", () => {
    expect(normalizeShopDomain("My-Store")).toBe("my-store.myshopify.com");
    expect(normalizeShopDomain("https://my-store.myshopify.com/admin")).toBe(
      "my-store.myshopify.com",
    );
    expect(() => normalizeShopDomain("not a shop")).toThrow();
  });

  it("verifies Shopify OAuth HMAC", () => {
    const secret = "shpss_test_secret";
    const query = {
      code: "abc",
      shop: "my-store.myshopify.com",
      state: "xyz",
      timestamp: "123",
    };
    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key as keyof typeof query]}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    expect(verifyShopifyHmac({ ...query, hmac }, secret)).toBe(true);
    expect(verifyShopifyHmac({ ...query, hmac: "bad" }, secret)).toBe(false);
  });
});

describe("commerce crypto", () => {
  it("round-trips secrets when an encryption key is set", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key";
    const encrypted = encryptSecret("shpat_example");
    expect(encrypted).not.toContain("shpat_example");
    expect(decryptSecret(encrypted)).toBe("shpat_example");
  });
});
