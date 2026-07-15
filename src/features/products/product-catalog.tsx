"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  ListFilterIcon,
  SearchIcon,
} from "lucide-react";
import type { Product, ProductStatus } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/product-image";
import { CatalogToolbar } from "@/features/products/catalog-toolbar";
import { CreateProductMenu } from "@/features/products/create-product-menu";
import { formatMoney } from "@/lib/format";

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
    product.sku,
    product.category,
    product.handle,
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

export function ProductCatalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">No products yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a product manually or import from Shopify to start building
          marketing intelligence.
        </p>
        <div className="mt-6 flex justify-center">
          <CreateProductMenu label="Create product" />
        </div>
      </div>
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

  const statusLabel =
    STATUS_FILTERS.find((option) => option.value === statusFilter)?.label ??
    "Filter";
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-8"
            aria-label="Search products"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" size="sm" />}
          >
            <ListFilterIcon data-icon="inline-start" />
            {statusFilter === "all" ? "Filter" : statusLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                {STATUS_FILTERS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" size="sm" />}
          >
            <ArrowUpDownIcon data-icon="inline-start" />
            {sort === "newest" ? "Sort" : sortLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as SortKey)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <CatalogToolbar>
          <CreateProductMenu label="Add products" />
        </CatalogToolbar>
      </div>

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
            <li key={product.id} className="bg-card rounded-lg border border-border overflow-hidden">
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
                    <h2 className="text-sm font-medium leading-snug">{product.title}</h2>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] uppercase tracking-wide"
                    >
                      {product.status}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                    <span className="font-mono">{formatMoney(product.price, product.currency)}</span>
                    <span>{product.channels.length} channels</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
