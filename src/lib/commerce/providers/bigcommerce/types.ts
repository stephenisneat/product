export type BigCommerceProduct = {
  id: number;
  name: string;
  type: string;
  sku?: string;
  description?: string;
  price?: number;
  sale_price?: number;
  retail_price?: number;
  is_visible?: boolean;
  availability?: string;
  inventory_tracking?: string;
  inventory_level?: number;
  categories?: number[];
  images?: {
    id: number;
    url_standard?: string;
    url_zoom?: string;
    is_thumbnail?: boolean;
  }[];
  variants?: BigCommerceVariant[];
  custom_url?: { url?: string };
};

export type BigCommerceVariant = {
  id: number;
  product_id: number;
  sku?: string;
  price?: number | null;
  sale_price?: number | null;
  retail_price?: number | null;
  inventory_level?: number;
  image_url?: string;
  option_values?: { id: number; label: string; option_display_name: string }[];
};

export type BigCommerceCategory = {
  id: number;
  name: string;
  custom_url?: { url?: string };
};
