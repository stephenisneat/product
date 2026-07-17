import type { Product, ProductType } from "@/domain";
import { formatMoney } from "@/lib/format";

export const PRODUCT_TYPE_OPTIONS: {
  value: ProductType;
  label: string;
  description: string;
}[] = [
  {
    value: "ecommerce",
    label: "Ecommerce",
    description: "Physical or digital goods you sell online",
  },
  {
    value: "mobile_app",
    label: "Mobile app",
    description: "iOS, Android, and web apps",
  },
  {
    value: "website",
    label: "Web app",
    description: "Marketing sites, SaaS products, and content",
  },
  {
    value: "brick_and_mortar",
    label: "Brick and mortar",
    description: "Physical storefronts and locations",
  },
  {
    value: "event",
    label: "Event",
    description: "Conferences, shows, and ticketed experiences",
  },
  {
    value: "election",
    label: "Election",
    description: "Candidates, races, and political campaigns",
  },
];

export function productTypeLabel(type: ProductType): string {
  return (
    PRODUCT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}

export function productSummaryLine(product: Product): string {
  switch (product.type) {
    case "ecommerce":
      return formatMoney(product.price, product.currency);
    case "mobile_app": {
      const platforms = product.metadata.platforms.join(" · ");
      return product.metadata.category
        ? `${platforms} · ${product.metadata.category}`
        : platforms;
    }
    case "website":
      return product.metadata.primaryDomain || product.metadata.url;
    case "brick_and_mortar":
      return `${product.metadata.city}, ${product.metadata.region}`;
    case "event": {
      const date = formatDisplayDate(product.metadata.startAt);
      return `${date} · ${product.metadata.venue}`;
    }
    case "election":
      return `${product.metadata.office} · ${product.metadata.jurisdiction}`;
    default:
      return "";
  }
}

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function optionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
