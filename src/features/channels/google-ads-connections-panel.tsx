"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatCustomerId } from "@/lib/channels/providers/google-ads/format";
import { cn } from "@/lib/utils";

type AdConnection = {
  id: string;
  provider: string;
  externalAccountId: string | null;
  accountName: string;
  currencyCode?: string | null;
  timeZone?: string | null;
  isManager: boolean;
  status: string;
};

type AccessibleAccount = {
  customerId: string;
  descriptiveName: string;
  currencyCode: string | null;
  timeZone: string | null;
  manager: boolean;
  testAccount: boolean;
  linked: boolean;
};

export function GoogleAdsConnectionsPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [configured, setConfigured] = useState(true);
  const [connections, setConnections] = useState<AdConnection[]>([]);
  const [pending, setPending] = useState<AdConnection | null>(null);
  const [accounts, setAccounts] = useState<AccessibleAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loginCustomerId, setLoginCustomerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConnections = useMemo(
    () =>
      connections.filter(
        (c) => c.status === "active" && c.externalAccountId,
      ),
    [connections],
  );

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google-ads/connections");
      const body = (await res.json()) as {
        error?: string;
        googleAdsConfigured?: boolean;
        connections?: AdConnection[];
        pending?: AdConnection | null;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load connections");
      setConfigured(body.googleAdsConfigured ?? false);
      setConnections(body.connections ?? []);
      setPending(body.pending ?? null);
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccessibleAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google-ads/accounts");
      const body = (await res.json()) as {
        error?: string;
        accounts?: AccessibleAccount[];
      };
      if (!res.ok) throw new Error(body.error || "Failed to list accounts");
      setAccounts(body.accounts ?? []);
      setSelectMode(true);
      const managers = (body.accounts ?? []).filter((a) => a.manager);
      if (managers[0]) {
        setLoginCustomerId(managers[0].customerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list accounts");
    } finally {
      setLoading(false);
    }
  }, []);

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
    const status = searchParams.get("google_ads");
    if (!status) return;

    void Promise.resolve().then(() => {
      if (status === "select_account") {
        toast.success("Google account connected. Select Ads accounts to link.");
        void loadAccessibleAccounts();
      } else if (status === "error") {
        const reason = searchParams.get("reason") || "unknown";
        toast.error(`Google Ads connection failed (${reason})`);
      }
      router.replace("/settings/connections", { scroll: false });
    });
  }, [searchParams, router, loadAccessibleAccounts]);

  useEffect(() => {
    if (!pending || selectMode) return;
    void Promise.resolve().then(() => {
      void loadAccessibleAccounts();
    });
  }, [pending, selectMode, loadAccessibleAccounts]);

  const toggleAccount = (customerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const linkAccounts = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one Google Ads account");
      return;
    }
    setLinking(true);
    try {
      const res = await fetch("/api/integrations/google-ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: [...selected],
          loginCustomerId: loginCustomerId || null,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to link accounts");
      toast.success("Google Ads account(s) linked");
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
    if (!confirm("Disconnect this Google Ads account?")) return;
    try {
      const res = await fetch(
        `/api/integrations/google-ads/connections?id=${encodeURIComponent(id)}`,
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
          <h2 className="text-sm font-medium">Google Ads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Search, Display, and YouTube accounts via OAuth. Manage
            campaigns, ad groups, ads, keywords, budgets, and reporting from
            Product Agent.
          </p>
        </div>
        {canManage && configured ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              window.location.href = "/api/integrations/google-ads/install";
            }}
          >
            {activeConnections.length > 0
              ? "Connect another"
              : "Connect Google Ads"}
          </Button>
        ) : null}
      </div>

      {!configured ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Google Ads is not configured on this deployment. Set{" "}
          <code className="font-mono text-[11px]">GOOGLE_ADS_CLIENT_ID</code>,{" "}
          <code className="font-mono text-[11px]">GOOGLE_ADS_CLIENT_SECRET</code>
          , and{" "}
          <code className="font-mono text-[11px]">GOOGLE_ADS_DEVELOPER_TOKEN</code>
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
                  {connection.accountName || "Google Ads account"}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatCustomerId(connection.externalAccountId ?? "")}
                  {connection.currencyCode ? ` · ${connection.currencyCode}` : ""}
                  {connection.isManager ? " · Manager" : ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
              >
                Connected
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={
                  <Link
                    href={`/settings/connections/google-ads/${connection.id}`}
                  />
                }
              >
                Manage
              </Button>
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
          No Google Ads accounts linked yet.
        </p>
      ) : null}

      {selectMode ? (
        <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-3">
          <p className="text-sm font-medium">Select accounts to link</p>
          <p className="text-xs text-muted-foreground">
            Choose the Google Ads customer accounts this workspace can manage
            (Search, Display, YouTube).
          </p>
          {accounts.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No accessible Google Ads accounts found for this Google user.
            </p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((account) => {
                const checked = selected.has(account.customerId);
                const disabled = account.linked;
                return (
                  <li key={account.customerId}>
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
                          if (!disabled) toggleAccount(account.customerId);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {account.descriptiveName}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {formatCustomerId(account.customerId)}
                          {account.manager ? " · Manager" : ""}
                          {account.testAccount ? " · Test" : ""}
                          {account.linked ? " · Already linked" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {accounts.some((a) => a.manager) ? (
            <div className="space-y-1.5">
              <Label htmlFor="login-customer" className="text-xs">
                Manager account (login-customer-id)
              </Label>
              <select
                id="login-customer"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={loginCustomerId}
                onChange={(e) => setLoginCustomerId(e.target.value)}
              >
                <option value="">None</option>
                {accounts
                  .filter((a) => a.manager)
                  .map((a) => (
                    <option key={a.customerId} value={a.customerId}>
                      {a.descriptiveName} ({formatCustomerId(a.customerId)})
                    </option>
                  ))}
              </select>
            </div>
          ) : null}

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
