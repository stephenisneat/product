export type WooCommerceProduct = {
  id: number;
  name: string;
  slug: string;
  status: string;
  description: string;
  short_description?: string;
  images: { id: number; src: string }[];
  categories: { id: number; name: string; slug: string }[];
  attributes: { id: number; name: string; position: number; options: string[] }[];
  variations: number[];
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  type?: string;
};

export type WooCommerceVariation = {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  image?: { src: string } | null;
  attributes: { id: number; name: string; option: string }[];
};
