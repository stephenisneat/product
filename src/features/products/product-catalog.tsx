"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SearchIcon } from "lucide-react";
import type { Product } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import { formatMoney } from "@/lib/format";

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

export function ProductCatalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">No products yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first product to start building marketing intelligence.
          Imports from Shopify, WooCommerce, and Amazon are coming soon.
        </p>
        <div className="mt-6 flex justify-center">
          <CreateProductButton label="Create product" />
        </div>
      </div>
    );
  }

  const filtered = products.filter((product) => matchesQuery(product, query));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="shrink-0 font-heading text-xl font-semibold tracking-tight">
          Product Agent
        </h1>
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
        <CreateProductButton label="Create product" className="ml-auto" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No matching products</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search, or clear the query to see all products.
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
                <div className="relative aspect-[4/3] overflow-hidden">
                  {product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
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
