"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft02Icon,
  Ellipsis,
  Loader2,
  SparklesIcon,
} from "@/components/icons";
import type { Product, WorkspacePlan } from "@/domain";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgentContext } from "@/features/agent/agent-context";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { EditProductDialog } from "@/features/products/edit-product-dialog";
import { ProductImageLightbox } from "@/features/products/product-image-lightbox";
import { getEntitlements } from "@/lib/billing/entitlements";
import {
  productSummaryLine,
  productTypeLabel,
} from "@/lib/products/product-type";
import { cn } from "@/lib/utils";

function sourceLabel(product: Product): string {
  if (!product.sourceProvider) return "Manual";
  const name =
    product.sourceProvider.charAt(0).toUpperCase() +
    product.sourceProvider.slice(1);
  if (product.syncedAt) {
    const date = new Date(product.syncedAt);
    if (!Number.isNaN(date.getTime())) {
      return `${name} · synced ${date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`;
    }
  }
  return name;
}

function channelFootprint(product: Product): string {
  if (product.channels.length === 0) return "No channels live";
  return product.channels.join(" · ");
}

export function ProductChrome({
  product,
  plan = "free",
}: {
  product: Product;
  plan?: WorkspacePlan;
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const ents = getEntitlements(plan);
  const campaignsLocked = !ents.canSpendAndLaunch;
  const creativesLocked = ents.maxVideoCreativesPerCampaign === 0;
  const canResync = Boolean(product.sourceProvider && product.sourceProductId);

  function askAgent(prompt: string) {
    setComposePrefill(prompt);
  }

  async function resync() {
    setMenuError(null);
    setResyncing(true);
    try {
      const res = await fetch(`/api/products/${product.id}/resync`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMenuError(body?.error ?? "Re-sync failed");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setResyncing(false);
    }
  }

  async function archive() {
    setMenuError(null);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMenuError(body?.error ?? "Archive failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {productTypeLabel(product.type)}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {product.status}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground line-clamp-2">
            {product.description || "No description yet."}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>{productSummaryLine(product)}</span>
            <span>{sourceLabel(product)}</span>
            <span>{channelFootprint(product)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              askAgent(
                `Help me improve marketing for ${product.title}. What should we focus on next?`,
              )
            }
          >
            <SparklesIcon className="size-3.5" />
            Ask agent
          </Button>
          {campaignsLocked ? (
            <UpgradeButton size="sm">New campaign</UpgradeButton>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                askAgent(
                  `Draft a campaign concept for ${product.title} and run create_campaign when ready.`,
                )
              }
            >
              New campaign
            </Button>
          )}
          {creativesLocked ? (
            <UpgradeButton size="sm">New creative</UpgradeButton>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                askAgent(
                  `Draft a creative concept for ${product.title} and create it when ready.`,
                )
              }
            >
              New creative
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="More product actions"
                />
              }
            >
              {resyncing || pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ellipsis className="size-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit details
              </DropdownMenuItem>
              {canResync ? (
                <DropdownMenuItem
                  disabled={resyncing}
                  onClick={() => void resync()}
                >
                  Re-sync from {product.sourceProvider}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={product.status === "archived"}
                onClick={() => void archive()}
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {menuError ? (
        <p className="text-xs text-destructive">{menuError}</p>
      ) : null}

      <nav
        className={cn(
          "flex flex-wrap gap-1 border-b border-border pb-2 text-xs",
        )}
        aria-label="Product sections"
      >
        {(
          [
            ["performance", "Performance"],
            ["pulse", "Pulse"],
            ["know", "Know"],
            ["decide", "Decide"],
            ["run", "Run"],
            ["improve", "Improve"],
            ["library", "Library"],
          ] as const
        ).map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </nav>

      <EditProductDialog
        product={product}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

export function ProductPageHeader({ product }: { product: Product }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const hasImages = product.images.length > 0;

  return (
    <>
      <div className="relative flex w-full items-center">
        <div className="z-10 flex min-w-0 max-w-[34%] items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1 size-7 shrink-0 rounded-md text-muted-foreground"
            aria-label="Back to products"
            render={<Link href="/" />}
          >
            <ArrowLeft02Icon className="size-4" />
          </Button>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 sm:px-28">
          <div className="flex min-w-0 max-w-full items-center gap-2.5">
            {hasImages ? (
              <button
                type="button"
                className="pointer-events-auto relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border bg-muted transition-opacity hover:opacity-90"
                aria-label={`View ${product.title} images`}
                onClick={() => setGalleryOpen(true)}
              >
                <ProductImage
                  src={product.images[0]}
                  avgColor={product.imageAvgColors[0]}
                  className="size-full"
                  sizes="32px"
                />
              </button>
            ) : (
              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted font-mono text-[9px] uppercase text-muted-foreground">
                {productTypeLabel(product.type).slice(0, 3)}
              </div>
            )}
            {hasImages ? (
              <h1 className="min-w-0 truncate text-sm font-medium">
                <button
                  type="button"
                  className="pointer-events-auto max-w-full cursor-pointer truncate"
                  onClick={() => setGalleryOpen(true)}
                >
                  {product.title}
                </button>
              </h1>
            ) : (
              <h1 className="truncate text-sm font-medium">{product.title}</h1>
            )}
          </div>
        </div>
      </div>

      <ProductImageLightbox
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        images={product.images}
        avgColors={product.imageAvgColors}
        title={product.title}
      />
    </>
  );
}
