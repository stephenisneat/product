"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  ListFilterIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import type { Creative, CreativeStatus, Product } from "@/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CreateAudioAdDialog } from "@/features/creatives/create-audio-ad-dialog";
import { CreateDisplayAdDialog } from "@/features/creatives/create-display-ad-dialog";
import { CreateSearchAdDialog } from "@/features/creatives/create-search-ad-dialog";
import { CreateVideoAdDialog } from "@/features/creatives/create-video-ad-dialog";
import { CreativeCard } from "@/features/creatives/creative-card";
import { UploadVideoAdDialog } from "@/features/creatives/upload-video-ad-dialog";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";
import { cn } from "@/lib/utils";

export type CreativesStatusFilter = "all" | CreativeStatus;

const CREATIVE_STATUS_ORDER: CreativeStatus[] = [
  "awaiting_review",
  "generating",
  "revising",
  "paused",
  "ready",
  "rejected",
];

const CREATIVE_STATUS_LABELS: Record<CreativeStatus, string> = {
  awaiting_review: "Awaiting review",
  generating: "Generating",
  revising: "Revising",
  paused: "Paused",
  ready: "Ready",
  rejected: "Rejected",
};

const STATUS_FILTERS: { value: CreativesStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...CREATIVE_STATUS_ORDER.map((value) => ({
    value,
    label: CREATIVE_STATUS_LABELS[value],
  })),
];

function matchesQuery(creative: Creative, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    creative.title.toLowerCase().includes(q) ||
    creative.brief.toLowerCase().includes(q)
  );
}

function CreativeStatusGroup({
  status,
  creatives,
  onDeleted,
}: {
  status: CreativeStatus;
  creatives: Creative[];
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const label = CREATIVE_STATUS_LABELS[status];

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md py-1 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {creatives.length}
        </span>
      </button>
      {open ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {creatives.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                pollWhileGenerating={false}
                onDeleted={onDeleted}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
  const [statusFilter, setStatusFilter] =
    useState<CreativesStatusFilter>("all");
  const hasGenerating = creatives.some((c) => c.status === "generating");
  const awaitingReviewCount = creatives.filter(
    (c) => c.status === "awaiting_review",
  ).length;

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

  const filtered = creatives.filter(
    (c) =>
      matchesQuery(c, query) &&
      (statusFilter === "all" || c.status === statusFilter),
  );

  const grouped = CREATIVE_STATUS_ORDER.map((status) => ({
    status,
    creatives: filtered.filter((c) => c.status === status),
  })).filter((group) => group.creatives.length > 0);

  const handleDeleted = (id: string) => {
    setCreatives((prev) => prev.filter((c) => c.id !== id));
  };

  const headerActions = (
    <CatalogHeaderActions>
      <div className="flex flex-wrap items-center gap-2">
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

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="relative aspect-square"
                aria-label="Filter creatives"
              />
            }
          >
            <ListFilterIcon />
            {awaitingReviewCount > 0 && statusFilter === "all" ? (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] font-medium text-background">
                {awaitingReviewCount > 9 ? "9+" : awaitingReviewCount}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="min-w-48 p-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Status
            </p>
            <div className="space-y-0.5">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
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
                  {option.value === "awaiting_review" &&
                  awaitingReviewCount > 0 ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {awaitingReviewCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <CreateVideoAdDialog
          products={products}
          onCreated={(creative) =>
            setCreatives((prev) => [
              creative,
              ...prev.filter((c) => c.id !== creative.id),
            ])
          }
        />
        <CreateDisplayAdDialog
          products={products}
          onCreated={(creative) =>
            setCreatives((prev) => [
              creative,
              ...prev.filter((c) => c.id !== creative.id),
            ])
          }
        />
        <CreateSearchAdDialog
          products={products}
          onCreated={(creative) =>
            setCreatives((prev) => [
              creative,
              ...prev.filter((c) => c.id !== creative.id),
            ])
          }
        />
        <CreateAudioAdDialog
          products={products}
          onCreated={(creative) =>
            setCreatives((prev) => [
              creative,
              ...prev.filter((c) => c.id !== creative.id),
            ])
          }
        />
        <UploadVideoAdDialog
          products={products}
          onUploaded={(creative) =>
            setCreatives((prev) => [
              creative,
              ...prev.filter((c) => c.id !== creative.id),
            ])
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
          No creatives yet. Create a video, display, search, or audio ad, upload
          an MP4, or describe an idea in chat.
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
            Try a different search or status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <CreativeStatusGroup
              key={group.status}
              status={group.status}
              creatives={group.creatives}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </>
  );
}
