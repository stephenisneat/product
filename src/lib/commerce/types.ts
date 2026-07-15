import type { CanonicalProduct, CommerceProvider } from "@/domain";

export type { CanonicalProduct };

export type ShopifyRemoteProductSummary = {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl?: string;
  variantCount: number;
};

export interface CommerceImportAdapter {
  provider: CommerceProvider;
  listProducts(accessToken: string, shopDomain: string): Promise<ShopifyRemoteProductSummary[]>;
  fetchProducts(
    accessToken: string,
    shopDomain: string,
    productIds: string[],
  ): Promise<CanonicalProduct[]>;
}
