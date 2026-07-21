"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type AdConnection = {
  id: string;
  provider: string;
  externalAccountId: string | null;
  accountName: string;
  currencyCode?: string | null;
  timeZone?: string | null;
  status: string;
};

type AccessibleAccount = {
  accountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
  linked: boolean;
};

export type AdChannelPanelConfig = {
  /** Display name, e.g. "Meta Ads" */
  name: string;
  description: string;
  /** Query param used in OAuth redirects, e.g. "meta" or "amazon_ads" */
  queryParam: string;
  /** Response key for configured flag, e.g. "metaConfigured" */
  configuredKey: string;
  installPath: string;
  connectionsPath: string;
  accountsPath: string;
  /** Env var names shown when not configured */
  envVars: string[];
  accountNoun?: string;
};

export function AdChannelConnectionsPanel({
  canManage,
  config,
}: {
  canManage: boolean;
  config: AdChannelPanelConfig;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountNoun = config.accountNoun ?? "account";
  const [configured, setConfigured] = useState(true);
  const [connections, setConnections] = useState<AdConnection[]>([]);
  const [pending, setPending] = useState<AdConnection | null>(null);
  const [accounts, setAccounts] = useState<AccessibleAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConnections = useMemo(
    () =>
      connections.filter((c) => c.status === "active" && c.externalAccountId),
    [connections],
  );

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(config.connectionsPath);
      const body = (await res.json()) as Record<string, unknown> & {
        error?: string;
        connections?: AdConnection[];
        pending?: AdConnection | null;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load connections");
      setConfigured(Boolean(body[config.configuredKey] ?? false));
      setConnections(body.connections ?? []);
      setPending(body.pending ?? null);
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }, [config.connectionsPath, config.configuredKey]);

  const loadAccessibleAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(config.accountsPath);
      const body = (await res.json()) as {
        error?: string;
        accounts?: AccessibleAccount[];
      };
      if (!res.ok) throw new Error(body.error || "Failed to list accounts");
      setAccounts(body.accounts ?? []);
      setSelectMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list accounts");
    } finally {
      setLoading(false);
    }
  }, [config.accountsPath]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      await loadConnections();
    });
    return () => {
      cancelled = true;
    };
  }, [loadConnections]);

  useEffect(() => {
    const status = searchParams.get(config.queryParam);
    if (!status) return;

    void Promise.resolve().then(() => {
      if (status === "select_account") {
        toast.success(
          `${config.name} connected. Select ${accountNoun}s to link.`,
        );
        void loadAccessibleAccounts();
      } else if (status === "error") {
        const reason = searchParams.get("reason") || "unknown";
        toast.error(`${config.name} connection failed (${reason})`);
      }
      router.replace("/settings/connections", { scroll: false });
    });
  }, [
    searchParams,
    router,
    loadAccessibleAccounts,
    config.queryParam,
    config.name,
    accountNoun,
  ]);

  useEffect(() => {
    if (!pending || selectMode) return;
    void Promise.resolve().then(() => {
      void loadAccessibleAccounts();
    });
  }, [pending, selectMode, loadAccessibleAccounts]);

  const toggleAccount = (accountId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const linkAccounts = async () => {
    if (selected.size === 0) {
      toast.error(`Select at least one ${config.name} ${accountNoun}`);
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(config.accountsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: [...selected] }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to link accounts");
      toast.success(`${config.name} ${accountNoun}(s) linked`);
      setSelectMode(false);
      setAccounts([]);
      setSelected(new Set());
      await loadConnections();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link");
    } finally {
      setLinking(false);
    }
  };

  const disconnect = async (id: string) => {
    if (!confirm(`Disconnect this ${config.name} ${accountNoun}?`)) return;
    try {
      const res = await fetch(
        `${config.connectionsPath}?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to disconnect");
      toast.success("Disconnected");
      await loadConnections();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  return (
    <section className="rounded-lg border border-border px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{config.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.description}
          </p>
        </div>
        {canManage && configured ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              window.location.href = config.installPath;
            }}
          >
            {activeConnections.length > 0
              ? "Connect another"
              : `Connect ${config.name}`}
          </Button>
        ) : null}
      </div>

      {!configured ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {config.name} is not configured on this deployment. Set{" "}
          {config.envVars.map((env, index) => (
            <span key={env}>
              {index > 0 ? (index === config.envVars.length - 1 ? ", and " : ", ") : null}
              <code className="font-mono text-[11px]">{env}</code>
            </span>
          ))}
          .
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}

      {loading && !selectMode ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {activeConnections.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {activeConnections.map((connection) => (
            <li
              key={connection.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {connection.accountName || `${config.name} ${accountNoun}`}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {connection.externalAccountId}
                  {connection.currencyCode
                    ? ` · ${connection.currencyCode}`
                    : ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
              >
                Connected
              </Badge>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void disconnect(connection.id)}
                >
                  Disconnect
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !loading && !selectMode && configured ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No {config.name} {accountNoun}s linked yet.
        </p>
      ) : null}

      {selectMode ? (
        <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-3">
          <p className="text-sm font-medium">
            Select {accountNoun}s to link
          </p>
          <p className="text-xs text-muted-foreground">
            Choose the {config.name} {accountNoun}s this workspace can manage.
          </p>
          {accounts.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No accessible {config.name} {accountNoun}s found for this user.
            </p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((account) => {
                const checked = selected.has(account.accountId);
                const disabled = account.linked;
                return (
                  <li key={account.accountId}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                        disabled && "cursor-default opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked || disabled}
                        disabled={disabled || linking}
                        onCheckedChange={() => {
                          if (!disabled) toggleAccount(account.accountId);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{account.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {account.accountId}
                          {account.currencyCode
                            ? ` · ${account.currencyCode}`
                            : ""}
                          {account.linked ? " · Already linked" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={linking || selected.size === 0}
              onClick={() => void linkAccounts()}
            >
              {linking ? "Linking…" : "Link selected"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={linking}
              onClick={() => {
                setSelectMode(false);
                setAccounts([]);
                setSelected(new Set());
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export const META_ADS_PANEL_CONFIG: AdChannelPanelConfig = {
  name: "Meta Ads",
  description:
    "Connect Facebook and Instagram ad accounts via OAuth to manage campaigns from Product Agent.",
  queryParam: "meta",
  configuredKey: "metaConfigured",
  installPath: "/api/integrations/meta/install",
  connectionsPath: "/api/integrations/meta/connections",
  accountsPath: "/api/integrations/meta/accounts",
  envVars: ["META_APP_ID", "META_APP_SECRET"],
};

export const TIKTOK_ADS_PANEL_CONFIG: AdChannelPanelConfig = {
  name: "TikTok Ads",
  description:
    "Connect TikTok advertiser accounts via OAuth to manage campaigns from Product Agent.",
  queryParam: "tiktok",
  configuredKey: "tiktokConfigured",
  installPath: "/api/integrations/tiktok/install",
  connectionsPath: "/api/integrations/tiktok/connections",
  accountsPath: "/api/integrations/tiktok/accounts",
  envVars: ["TIKTOK_ADS_APP_ID", "TIKTOK_ADS_APP_SECRET"],
  accountNoun: "advertiser",
};

export const AMAZON_ADS_PANEL_CONFIG: AdChannelPanelConfig = {
  name: "Amazon Ads",
  description:
    "Connect Amazon Advertising profiles (Sponsored Products, Brands, Display) via OAuth. Separate from Amazon Seller/SP-API catalog sync.",
  queryParam: "amazon_ads",
  configuredKey: "amazonAdsConfigured",
  installPath: "/api/integrations/amazon-ads/install",
  connectionsPath: "/api/integrations/amazon-ads/connections",
  accountsPath: "/api/integrations/amazon-ads/accounts",
  envVars: ["AMAZON_ADS_CLIENT_ID", "AMAZON_ADS_CLIENT_SECRET"],
  accountNoun: "profile",
};

export const X_ADS_PANEL_CONFIG: AdChannelPanelConfig = {
  name: "X Ads",
  description:
    "Connect X (Twitter) ad accounts via OAuth to manage campaigns from Product Agent.",
  queryParam: "x_ads",
  configuredKey: "xAdsConfigured",
  installPath: "/api/integrations/x-ads/install",
  connectionsPath: "/api/integrations/x-ads/connections",
  accountsPath: "/api/integrations/x-ads/accounts",
  envVars: ["X_ADS_CLIENT_ID", "X_ADS_CLIENT_SECRET"],
};
