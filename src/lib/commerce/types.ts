import type { CanonicalProduct, CommerceProvider } from "@/domain";

export type { CanonicalProduct };

export type RemoteProductSummary = {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl?: string;
  variantCount: number;
};

/** @deprecated Use RemoteProductSummary */
export type ShopifyRemoteProductSummary = RemoteProductSummary;

export interface CommerceImportAdapter {
  provider: CommerceProvider;
  listProducts(
    accessToken: string,
    shopDomain: string,
  ): Promise<RemoteProductSummary[]>;
  fetchProducts(
    accessToken: string,
    shopDomain: string,
    productIds: string[],
  ): Promise<CanonicalProduct[]>;
}
