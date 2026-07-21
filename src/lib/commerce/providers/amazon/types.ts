export type AmazonListingItem = {
  sku: string;
  summaries?: {
    marketplaceId?: string;
    asin?: string;
    productType?: string;
    status?: string[];
    itemName?: string;
    mainImage?: { link?: string };
  }[];
  attributes?: Record<
    string,
    { value?: string | number | boolean; marketplace_id?: string }[]
  >;
  offers?: {
    marketplaceId?: string;
    price?: { currencyCode?: string; amount?: number | string };
  }[];
  fulfillmentAvailability?: {
    fulfillmentChannelCode?: string;
    quantity?: number;
  }[];
};

export type AmazonListingsSearchResult = {
  numberOfResults?: number;
  pagination?: { nextToken?: string };
  items?: AmazonListingItem[];
};
