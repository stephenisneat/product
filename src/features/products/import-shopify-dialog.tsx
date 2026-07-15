"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type RemoteProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl?: string;
  variantCount: number;
};

type Connection = {
  id: string;
  provider: string;
  shopDomain: string;
  status: string;
};

export function ImportShopifyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shopInput, setShopInput] = useState("");
  const [shopConfigured, setShopConfigured] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeShop, setActiveShop] = useState<string | null>(null);
  const [products, setProducts] = useState<RemoteProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopifyConnections = useMemo(
    () => connections.filter((connection) => connection.provider === "shopify"),
    [connections],
  );

  const loadRemoteProducts = useCallback(async (shop: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/shopify/products?shop=${encodeURIComponent(shop)}`,
      );
      const body = (await res.json()) as {
        error?: string;
        products?: RemoteProduct[];
        shop?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load products");
      setProducts(body.products ?? []);
      setActiveShop(body.shop ?? shop);
      setSelected(new Set((body.products ?? []).map((product) => product.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConnections = useCallback(
    async (preferredShop?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/integrations/connections");
        const body = (await res.json()) as {
          error?: string;
          shopifyConfigured?: boolean;
          connections?: Connection[];
        };
        if (!res.ok) throw new Error(body.error || "Failed to load connections");
        setShopConfigured(body.shopifyConfigured ?? false);
        setConnections(body.connections ?? []);
        const preferred =
          preferredShop ||
          (body.connections ?? []).find(
            (connection) =>
              connection.provider === "shopify" && connection.status === "active",
          )?.shopDomain;
        if (preferred) {
          setActiveShop(preferred);
          await loadRemoteProducts(preferred);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load connections",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadRemoteProducts],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const preferredFromUrl =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("shop")
        : null;

    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadConnections(preferredFromUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, loadConnections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("shopify");
    if (!status) return;

    const shop = params.get("shop");
    const reason = params.get("reason") ?? "unknown";

    params.delete("shopify");
    params.delete("shop");
    params.delete("reason");
    const next = params.toString();
    const path = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", path);

    if (status === "connected") {
      toast.success(shop ? `Connected to ${shop}` : "Shopify store connected");
      startTransition(() => {
        onOpenChange(true);
        if (shop) setActiveShop(shop);
      });
    } else if (status === "error") {
      toast.error(`Shopify connection failed (${reason})`);
    }
  }, [onOpenChange, startTransition]);

  function toggleProduct(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(products.map((product) => product.id)));
    } else {
      setSelected(new Set());
    }
  }

  function startInstall() {
    if (!shopInput.trim()) {
      setError("Enter your Shopify store domain.");
      return;
    }
    window.location.href = `/api/integrations/shopify/install?shop=${encodeURIComponent(shopInput.trim())}`;
  }

  async function onImport() {
    if (!activeShop || selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/shopify/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: activeShop,
          productIds: Array.from(selected),
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        imported?: number;
      };
      if (!res.ok) throw new Error(body.error || "Import failed");
      toast.success(
        `Imported ${body.imported ?? selected.size} product${(body.imported ?? selected.size) === 1 ? "" : "s"}`,
      );
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const allSelected =
    products.length > 0 && selected.size === products.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Shopify</DialogTitle>
          <DialogDescription>
            Connect your store with OAuth, then choose which products to import.
          </DialogDescription>
        </DialogHeader>

        {!shopConfigured ? (
          <p className="text-sm text-muted-foreground">
            Shopify is not configured for this environment. Add{" "}
            <span className="font-mono text-xs">SHOPIFY_API_KEY</span>,{" "}
            <span className="font-mono text-xs">SHOPIFY_API_SECRET</span>, and{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span>.
          </p>
        ) : !activeShop ? (
          <div className="space-y-3">
            {shopifyConnections.length > 0 ? (
              <div className="space-y-2">
                <Label>Connected stores</Label>
                <ul className="space-y-1">
                  {shopifyConnections.map((connection) => (
                    <li key={connection.id}>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start font-mono text-xs"
                        onClick={() => {
                          void loadRemoteProducts(connection.shopDomain);
                        }}
                      >
                        {connection.shopDomain}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="shop-domain">
                {shopifyConnections.length > 0
                  ? "Connect another store"
                  : "Store domain"}
              </Label>
              <Input
                id="shop-domain"
                placeholder="my-store.myshopify.com"
                value={shopInput}
                onChange={(event) => setShopInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    startInstall();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                You will be redirected to Shopify to install the Product Agent
                app.
              </p>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={startInstall} disabled={loading}>
                Connect Shopify
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate font-mono">{activeShop}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setActiveShop(null);
                  setProducts([]);
                  setSelected(new Set());
                }}
              >
                Change store
              </Button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading products…
              </p>
            ) : products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No products found in this store.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                  />
                  Select all ({products.length})
                </label>
                <ScrollArea className="h-64 rounded-md border border-border">
                  <ul className="divide-y divide-border p-1">
                    {products.map((product) => {
                      const isChecked = selected.has(product.id);
                      return (
                        <li key={product.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                            <Checkbox
                              className="mt-0.5"
                              checked={isChecked}
                              onCheckedChange={() => toggleProduct(product.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {product.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.status.toLowerCase()} ·{" "}
                                {product.variantCount} variant
                                {product.variantCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </>
            )}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importing || selected.size === 0 || loading}
                onClick={() => void onImport()}
              >
                {importing
                  ? "Importing…"
                  : `Import ${selected.size || ""} product${selected.size === 1 ? "" : "s"}`.trim()}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
