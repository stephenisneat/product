"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "@/components/icons";
import type { Creative, Product } from "@/domain";
import { Input } from "@/components/ui/input";
import { CreativeCard } from "@/features/creatives/creative-card";
import { UploadVideoAdDialog } from "@/features/creatives/upload-video-ad-dialog";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";

function matchesQuery(creative: Creative, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    creative.title.toLowerCase().includes(q) ||
    creative.brief.toLowerCase().includes(q)
  );
}

/**
 * List view that coalesces generating-creative polls into one workspace
 * fetch instead of N per-card `/api/creatives/:id` intervals.
 *
 * Remount via `key` when server creatives change (e.g. after router.refresh).
 */
export function CreativesList({
  initialCreatives,
  products,
}: {
  initialCreatives: Creative[];
  products: Pick<Product, "id" | "title">[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creatives, setCreatives] = useState(initialCreatives);
  const [query, setQuery] = useState("");
  const hasGenerating = creatives.some((c) => c.status === "generating");

  useEffect(() => {
    if (!hasGenerating) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/creatives");
        if (!res.ok) return;
        const body = (await res.json()) as { creatives?: Creative[] };
        if (cancelled || !body.creatives) return;
        setCreatives(body.creatives);
        if (!body.creatives.some((c) => c.status === "generating")) {
          startTransition(() => router.refresh());
        }
      } catch {
        // ignore poll errors
      }
    };

    const id = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasGenerating, router]);

  const filtered = creatives.filter((c) => matchesQuery(c, query));

  const headerActions = (
    <CatalogHeaderActions>
      <div className="flex items-center gap-2">
        <div className="relative w-44 sm:w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creatives…"
            className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            aria-label="Search creatives"
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
        <UploadVideoAdDialog
          products={products}
          onUploaded={(creative) =>
            setCreatives((prev) => [creative, ...prev.filter((c) => c.id !== creative.id)])
          }
        />
      </div>
    </CatalogHeaderActions>
  );

  if (creatives.length === 0) {
    return (
      <>
        {headerActions}
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No video creatives yet. Upload your own video ad, or describe an idea
          in chat to generate screenplay → storyboard → video.
        </div>
      </>
    );
  }

  return (
    <>
      {headerActions}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No matching creatives</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                pollWhileGenerating={false}
                onDeleted={(id) =>
                  setCreatives((prev) => prev.filter((c) => c.id !== id))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
