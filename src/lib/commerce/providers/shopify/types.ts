export type ShopifyGraphQLProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml: string;
  featuredImage?: { url: string } | null;
  images: {
    nodes: { url: string }[];
  };
  options: { name: string; position: number }[];
  variants: {
    nodes: {
      id: string;
      title: string;
      sku: string | null;
      barcode: string | null;
      price: string;
      compareAtPrice: string | null;
      inventoryQuantity: number | null;
      inventoryItem: { tracked: boolean } | null;
      selectedOptions: { name: string; value: string }[];
      image?: { url: string } | null;
    }[];
  };
  collections: {
    nodes: {
      id: string;
      title: string;
      handle: string;
    }[];
  };
};
