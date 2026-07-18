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
} from "lucide-react";
import type { Product, ProductStatus } from "@/domain";
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
import { CatalogNav } from "@/features/products/catalog-toolbar";
import {
  productSummaryLine,
  productTypeLabel,
} from "@/lib/products/product-type";
import { cn } from "@/lib/utils";

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

export function ProductCatalog({
  products,
  workspaceId,
}: {
  products: Product[];
  workspaceId: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  if (products.length === 0) {
    return (
      <PageCanvas
        header={
          <div className="flex w-full flex-wrap items-center gap-2">
            <CatalogNav workspaceId={workspaceId} />
            <div className="ml-auto">
              <Button
                render={<Link href="/products/new" />}
                size="sm"
                className={addProductsButtonClass}
              >
                <PlusIcon data-icon="inline-start" />
                Add products
              </Button>
            </div>
          </div>
        }
      >
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            No products yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an ecommerce product, app, website, store, event, or election —
            or import from Shopify to start building marketing intelligence.
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

  return (
    <PageCanvas
      header={
        <div className="flex w-full flex-wrap items-center gap-2">
          <CatalogNav workspaceId={workspaceId} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
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
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
            <p className="text-sm font-medium">No matching products</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different search, filter, or clear the query to see all
              products.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <li
                key={product.id}
                className="bg-card overflow-hidden rounded-lg border border-border"
              >
                <Link
                  href={`/products/${product.id}`}
                  className="group flex h-full flex-col outline-none transition-colors focus-visible:bg-muted/40"
                >
                  {product.images[0] ? (
                    <ProductImage
                      src={product.images[0]}
                      avgColor={product.imageAvgColors[0]}
                      className="aspect-[4/3]"
                      imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  ) : (
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm leading-snug font-medium">
                        {product.title}
                      </h2>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] tracking-wide uppercase"
                        >
                          {productTypeLabel(product.type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] tracking-wide uppercase"
                        >
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {product.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate font-mono">
                        {productSummaryLine(product)}
                      </span>
                      <span className="shrink-0">
                        {product.channels.length} channels
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageCanvas>
  );
}
