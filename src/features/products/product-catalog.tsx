"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  CheckIcon,
  ListFilterIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import type { PerformancePoint, Product, ProductStatus } from "@/domain";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PageCanvas } from "@/components/layout/page-canvas";
import { ProductImage } from "@/components/product-image";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";
import {
  CATALOG_STATUS_LABELS,
  CATALOG_STATUS_ORDER,
  type CatalogStatus,
} from "@/features/products/catalog-status";
import { formatMoney } from "@/lib/format";
import {
  productSummaryLine,
  productTypeLabel,
} from "@/lib/products/product-type";
import { cn } from "@/lib/utils";

type CatalogInsightPreview = {
  title: string;
  summary: string;
  status: string;
};

type CatalogPerformanceTotals = Omit<PerformancePoint, "date">;

function formatCatalogMetric(
  key: "spend" | "revenue" | "roas",
  value: number,
): string {
  if (key === "spend" || key === "revenue") return formatMoney(value);
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

type StatusFilter = "all" | ProductStatus;
type SortKey =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "price-asc"
  | "price-desc";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

function matchesQuery(product: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    product.title,
    product.description,
    product.status,
    product.type,
    productTypeLabel(product.type),
    product.sku,
    product.category,
    product.handle,
    productSummaryLine(product),
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

function sortProducts(products: Product[], sort: SortKey) {
  const sorted = [...products];
  switch (sort) {
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "newest":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

const addProductsButtonClass =
  "border-0 bg-[#288DFF] bg-clip-border text-white shadow-[0_0_0_1px_#288DFF,0_1px_2px_0_rgba(14,18,27,0.24),inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-[#1f7ff5] hover:text-white focus-visible:border-transparent focus-visible:ring-0 aria-expanded:bg-[#288DFF] aria-expanded:text-white dark:bg-[#288DFF] dark:text-white dark:hover:bg-[#1f7ff5]";

function insightDescription(insight: CatalogInsightPreview | undefined) {
  if (!insight) return null;
  const summary = insight.summary.trim();
  if (summary) return summary;
  const title = insight.title.trim();
  if (title) return title;
  if (insight.status === "generating") return "Generating insight…";
  return null;
}

function CatalogMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 text-right">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="tabular-nums text-xs font-medium">{value}</p>
    </div>
  );
}

function ProductCard({
  product,
  insight,
  performance,
}: {
  product: Product;
  insight?: CatalogInsightPreview;
  performance?: CatalogPerformanceTotals;
}) {
  const insightText = insightDescription(insight);
  const hasPerformance =
    performance &&
    (performance.spend > 0 ||
      performance.revenue > 0 ||
      performance.impressions > 0 ||
      performance.clicks > 0 ||
      performance.conversions > 0);
  const roas =
    performance && performance.spend > 0
      ? performance.revenue / performance.spend
      : 0;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        "md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent",
      )}
    >
      <Link
        href={`/products/${product.id}`}
        className={cn(
          "group flex h-full flex-col outline-none transition-colors focus-visible:bg-white/[0.06]",
          "md:h-12 md:flex-row md:items-center md:gap-3 md:overflow-hidden md:px-9 md:hover:bg-white/[0.06]",
        )}
      >
        {product.images[0] ? (
          <ProductImage
            src={product.images[0]}
            avgColor={product.imageAvgColors[0]}
            className="aspect-[4/3] md:size-8 md:shrink-0 md:rounded-md"
            imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 32px"
          />
        ) : (
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden text-xs text-muted-foreground md:size-8 md:shrink-0 md:rounded-md md:bg-muted">
            No image
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-3 md:min-w-0 md:flex-row md:items-center md:gap-3 md:overflow-hidden md:p-0">
          <div className="min-w-0 flex-1 space-y-1 md:space-y-0">
            <div className="flex items-start justify-between gap-2 md:items-center">
              <div className="flex w-full min-w-0 items-center justify-start gap-4 relative">
                <h2 className="w-80 shrink-0 text-sm leading-snug font-medium md:truncate">
                  {product.title}
                </h2>
                <div
                  className={cn(
                    "hidden w-full truncate text-xs md:block",
                    insightText
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                  )}
                  title={insightText ?? undefined}
                >
                  {insightText ?? "No insights yet"}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3">
                {hasPerformance && performance ? (
                  <>
                    <CatalogMetric
                      label="Spend"
                      value={formatCatalogMetric("spend", performance.spend)}
                    />
                    <CatalogMetric
                      label="Revenue"
                      value={formatCatalogMetric(
                        "revenue",
                        performance.revenue,
                      )}
                    />
                    <CatalogMetric
                      label="ROAS"
                      value={formatCatalogMetric("roas", roas)}
                    />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/60">
                    No metrics
                  </span>
                )}
              </div>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground md:hidden">
              {insightText ?? product.description}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function ProductCatalog({
  products,
  catalogStatusByProductId,
  latestInsightByProductId = {},
  performanceByProductId = {},
}: {
  products: Product[];
  catalogStatusByProductId: Record<string, CatalogStatus>;
  latestInsightByProductId?: Record<string, CatalogInsightPreview>;
  performanceByProductId?: Record<string, CatalogPerformanceTotals>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  if (products.length === 0) {
    return (
      <PageCanvas>
        <CatalogHeaderActions>
          <Button
            render={<Link href="/products/new" />}
            size="sm"
            className={addProductsButtonClass}
          >
            <PlusIcon data-icon="inline-start" />
            Add products
          </Button>
        </CatalogHeaderActions>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            No products yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an ecommerce product, app, website, store, event, or election —
            or import from Shopify, WooCommerce, BigCommerce, Amazon, or
            Squarespace to start building marketing intelligence.
          </p>
          <div className="mt-6 flex justify-center">
            <Button render={<Link href="/products/new" />} size="sm">
              <PlusIcon data-icon="inline-start" />
              Create product
            </Button>
          </div>
        </div>
      </PageCanvas>
    );
  }

  const filtered = sortProducts(
    products.filter(
      (product) =>
        matchesQuery(product, query) &&
        (statusFilter === "all" || product.status === statusFilter),
    ),
    sort,
  );

  const grouped = CATALOG_STATUS_ORDER.map((status) => ({
    status,
    products: filtered.filter(
      (product) =>
        (catalogStatusByProductId[product.id] ?? "inactive") === status,
    ),
  })).filter((group) => group.products.length > 0);

  return (
    <PageCanvas>
      <CatalogHeaderActions>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="aspect-square"
                aria-label="Filter products"
              />
            }
          >
            <ListFilterIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="min-w-56 p-0">
            <div className="p-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search products…"
                  className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  aria-label="Search products"
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <Separator className="my-0" />
            <div className="p-2">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                Status
              </p>
              <div className="space-y-0.5">
                {STATUS_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={optionItemClass}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        statusFilter === option.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="aspect-square"
                aria-label="Sort products"
              />
            }
          >
            <ArrowUpDownIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="min-w-48 p-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Sort by
            </p>
            <div className="space-y-0.5">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={optionItemClass}
                  onClick={() => {
                    setSort(option.value);
                    setSortOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      sort === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          render={<Link href="/products/new" />}
          size="sm"
          className={addProductsButtonClass}
        >
          <PlusIcon data-icon="inline-start" />
          Add products
        </Button>
      </CatalogHeaderActions>
      <div className="mx-auto max-w-[1600px] py-6">
        {filtered.length === 0 ? (
          <div className="mx-4 rounded-lg border border-dashed border-border px-4 py-16 text-center">
            <p className="text-sm font-medium">No matching products</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different search, filter, or clear the query to see all
              products.
            </p>
          </div>
        ) : (
          <Accordion
            multiple
            defaultValue={[...CATALOG_STATUS_ORDER]}
            className="w-full"
          >
            {grouped.map((group) => (
              <AccordionItem key={group.status} value={group.status}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {CATALOG_STATUS_LABELS[group.status]}
                    </span>
                    <Badge
                      variant="secondary"
                      className="border-0 bg-white/10 tabular-nums text-muted-foreground"
                    >
                      {group.products.length}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 md:pb-0 [&_a]:no-underline">
                  <ul className="grid gap-4 px-4 sm:grid-cols-2 md:grid-cols-1 md:gap-0 md:px-0">
                    {group.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        insight={latestInsightByProductId[product.id]}
                        performance={performanceByProductId[product.id]}
                      />
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </PageCanvas>
  );
}
