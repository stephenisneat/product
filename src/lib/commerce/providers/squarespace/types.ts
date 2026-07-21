export type SquarespaceProduct = {
  id: string;
  type?: string;
  storePageId?: string;
  name: string;
  description?: string;
  url?: string;
  urlSlug?: string;
  tags?: string[];
  isVisible?: boolean;
  images?: { id?: string; url?: string }[];
  variantAttributes?: string[];
  variants?: SquarespaceVariant[];
};

export type SquarespaceVariant = {
  id: string;
  sku?: string;
  pricing?: {
    basePrice?: { currency?: string; value?: string };
    salePrice?: { currency?: string; value?: string };
    onSale?: boolean;
  };
  stock?: {
    quantity?: number;
    unlimited?: boolean;
  };
  attributes?: Record<string, string>;
  image?: { url?: string } | null;
};

export type SquarespaceProductsResponse = {
  products: SquarespaceProduct[];
  pagination?: {
    hasNextPage?: boolean;
    nextPageCursor?: string | null;
    nextPageUrl?: string | null;
  };
};
