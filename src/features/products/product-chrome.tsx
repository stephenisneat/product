"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Ellipsis, Loader2, SparklesIcon } from "@/components/icons";
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
import { CreateVideoAdDialog } from "@/features/creatives/create-video-ad-dialog";
import { EditProductDialog } from "@/features/products/edit-product-dialog";
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
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {product.images[0] ? (
            <ProductImage
              src={product.images[0]}
              avgColor={product.imageAvgColors[0]}
              className="size-full"
              sizes="80px"
            />
          ) : (
            <div className="flex size-full items-center justify-center font-mono text-[10px] uppercase text-muted-foreground">
              {productTypeLabel(product.type).slice(0, 3)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              {product.title}
            </h1>
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
            <CreateVideoAdDialog
              products={[{ id: product.id, title: product.title }]}
            />
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

export function ProductBackLink() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1.5 text-muted-foreground"
      render={<Link href="/" />}
    >
      <ArrowLeft className="size-3.5" />
      Back
    </Button>
  );
}
