"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommerceProvider } from "@/domain";
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

export type CommerceConnectField = {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  required?: boolean;
};

export type CommerceProviderUiConfig = {
  provider: Exclude<CommerceProvider, "shopify">;
  title: string;
  description: string;
  configuredKey: `${Exclude<CommerceProvider, "shopify">}Configured`;
  queryParam: Exclude<CommerceProvider, "shopify">;
  connectMode: "oauth" | "credentials";
  installPath?: string;
  connectPath?: string;
  productsPath: string;
  importPath: string;
  shopFieldLabel: string;
  shopFieldPlaceholder: string;
  connectHint: string;
  connectButtonLabel: string;
  notConfiguredHint: ReactNode;
  extraFields?: CommerceConnectField[];
  /** Maps form values into the OAuth install query string (excluding shop). */
  buildInstallQuery?: (values: Record<string, string>) => string;
  /** Maps form values into the credentials connect JSON body. */
  buildConnectBody?: (values: Record<string, string>) => Record<string, string>;
};

export function ImportCommerceDialog({
  config,
  open,
  onOpenChange,
  embedded = false,
  onSuccess,
}: {
  config: CommerceProviderUiConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [formValues, setFormValues] = useState<Record<string, string>>({
    shop: "",
  });
  const [providerConfigured, setProviderConfigured] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeShop, setActiveShop] = useState<string | null>(null);
  const [products, setProducts] = useState<RemoteProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.provider === config.provider,
      ),
    [connections, config.provider],
  );

  const loadRemoteProducts = useCallback(
    async (shop: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${config.productsPath}?shop=${encodeURIComponent(shop)}`,
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
    },
    [config.productsPath],
  );

  const loadConnections = useCallback(
    async (preferredShop?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/integrations/connections");
        const body = (await res.json()) as {
          error?: string;
          connections?: Connection[];
        } & Record<string, boolean | undefined>;
        if (!res.ok) throw new Error(body.error || "Failed to load connections");
        setProviderConfigured(Boolean(body[config.configuredKey] ?? false));
        setConnections(body.connections ?? []);
        const preferred =
          preferredShop ||
          (body.connections ?? []).find(
            (connection) =>
              connection.provider === config.provider &&
              connection.status === "active",
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
    [config.configuredKey, config.provider, loadRemoteProducts],
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
    if (embedded) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get(config.queryParam);
    if (!status) return;

    const shop = params.get("shop");
    const reason = params.get("reason") ?? "unknown";

    params.delete(config.queryParam);
    params.delete("shop");
    params.delete("reason");
    const next = params.toString();
    const path = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", path);

    if (status === "connected") {
      toast.success(
        shop ? `Connected to ${shop}` : `${config.title} connected`,
      );
      startTransition(() => {
        onOpenChange(true);
        if (shop) setActiveShop(shop);
      });
    } else if (status === "error") {
      toast.error(`${config.title} connection failed (${reason})`);
    }
  }, [
    config.queryParam,
    config.title,
    embedded,
    onOpenChange,
    startTransition,
  ]);

  function setField(id: string, value: string) {
    setFormValues((prev) => ({ ...prev, [id]: value }));
  }

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

  async function startConnect() {
    const shop = (formValues.shop ?? "").trim();
    if (!shop && config.connectMode === "oauth" && config.provider !== "amazon") {
      // Amazon uses marketplace + sellerId; shop field is marketplace.
    }
    if (config.connectMode === "oauth") {
      if (config.provider === "amazon") {
        const sellerId = (formValues.sellerId ?? "").trim();
        if (!sellerId) {
          setError("Enter your Amazon Seller ID.");
          return;
        }
      } else if (!shop) {
        setError(`Enter your ${config.shopFieldLabel.toLowerCase()}.`);
        return;
      }

      const extra = config.buildInstallQuery?.(formValues) ?? "";
      const shopParam =
        config.provider === "amazon"
          ? `marketplace=${encodeURIComponent(shop || "ATVPDKIKX0DER")}`
          : `shop=${encodeURIComponent(shop)}`;
      window.location.href = `${config.installPath}?${shopParam}${extra ? `&${extra}` : ""}`;
      return;
    }

    if (!config.connectPath || !config.buildConnectBody) {
      setError("Connect is not configured for this provider.");
      return;
    }

    for (const field of config.extraFields ?? []) {
      if (field.required !== false && !(formValues[field.id] ?? "").trim()) {
        setError(`Enter your ${field.label.toLowerCase()}.`);
        return;
      }
    }
    if (!shop) {
      setError(`Enter your ${config.shopFieldLabel.toLowerCase()}.`);
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(config.connectPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.buildConnectBody(formValues)),
      });
      const body = (await res.json()) as { error?: string; shop?: string };
      if (!res.ok) throw new Error(body.error || "Connection failed");
      toast.success(
        body.shop ? `Connected to ${body.shop}` : `${config.title} connected`,
      );
      if (body.shop) {
        setActiveShop(body.shop);
        await loadRemoteProducts(body.shop);
      } else {
        await loadConnections();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function onImport() {
    if (!activeShop || selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(config.importPath, {
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
      if (onSuccess) {
        onSuccess();
      } else {
        onOpenChange(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const allSelected =
    products.length > 0 && selected.size === products.length;

  const footerClassName = embedded
    ? "mx-0 mb-0 rounded-xl border border-border bg-muted/40"
    : undefined;

  const body = !providerConfigured ? (
    <p className="text-sm text-muted-foreground">{config.notConfiguredHint}</p>
  ) : !activeShop ? (
    <div className="space-y-3">
      {providerConnections.length > 0 ? (
        <div className="space-y-2">
          <Label>Connected stores</Label>
          <ul className="space-y-1">
            {providerConnections.map((connection) => (
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
        <Label htmlFor={`${config.provider}-shop`}>
          {providerConnections.length > 0
            ? `Connect another (${config.shopFieldLabel})`
            : config.shopFieldLabel}
        </Label>
        <Input
          id={`${config.provider}-shop`}
          placeholder={config.shopFieldPlaceholder}
          value={formValues.shop ?? ""}
          onChange={(event) => setField("shop", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void startConnect();
            }
          }}
        />
        {(config.extraFields ?? []).map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${config.provider}-${field.id}`}>
              {field.label}
            </Label>
            <Input
              id={`${config.provider}-${field.id}`}
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              value={formValues[field.id] ?? ""}
              onChange={(event) => setField(field.id, event.target.value)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{config.connectHint}</p>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <DialogFooter className={footerClassName}>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void startConnect()}
          disabled={loading || connecting}
        >
          {connecting ? "Connecting…" : config.connectButtonLabel}
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

      <DialogFooter className={footerClassName}>
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
  );

  if (embedded) {
    if (!open) return null;
    return <div className="mx-auto w-full max-w-lg space-y-4">{body}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
