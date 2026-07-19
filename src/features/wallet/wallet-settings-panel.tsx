"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletSummary, WalletTransaction } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  AutoReloadDialog,
  BuyCreditsDialog,
  EditLimitDialog,
} from "@/features/wallet/wallet-dialogs";
import { formatCents } from "@/features/wallet/money";

function typeLabel(type: WalletTransaction["type"]): string {
  switch (type) {
    case "credit_purchase":
      return "Credit purchase";
    case "auto_reload":
      return "Auto-reload";
    case "ai_usage":
      return "AI usage";
    case "ad_spend":
      return "Ad spend";
    case "adjustment":
      return "Adjustment";
    case "refund":
      return "Refund";
    default:
      return type;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WalletSettingsPanel({
  workspaceName,
  transactions,
  loadError,
}: {
  workspaceName: string;
  transactions: WalletTransaction[];
  loadError: string | null;
}) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyOpen, setBuyOpen] = useState(false);
  const [autoReloadOpen, setAutoReloadOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setWalletError(null);
      const res = await fetch("/api/wallet");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        wallet?: WalletSummary;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load wallet");
      setWallet(body.wallet ?? null);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Balance</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading wallet…</p>
        ) : walletError ? (
          <p className="text-sm text-destructive">{walletError}</p>
        ) : !wallet ? (
          <p className="text-sm text-muted-foreground">
            Wallet is not available for {workspaceName}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="font-mono text-xl tabular-nums">
                {formatCents(wallet.balanceCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                Available credits for {workspaceName}
              </p>
            </div>
            {wallet.canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAutoReloadOpen(true)}
                >
                  Auto-reload
                </Button>
                <Button type="button" size="sm" onClick={() => setBuyOpen(true)}>
                  Buy credits
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {wallet ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Usage this month</h2>
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-sm">
              <span className="font-mono tabular-nums">
                {formatCents(wallet.usageMtdCents)}
              </span>
              <span className="ml-1.5 text-muted-foreground">
                used
                {wallet.usageLimitCents != null
                  ? ` of ${formatCents(wallet.usageLimitCents)}`
                  : ""}
              </span>
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Resets on {wallet.resetsOn}
              </p>
              {wallet.canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLimitOpen(true)}
                >
                  Change limit
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Transaction history</h2>
        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No transactions yet. Buy credits to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {formatWhen(tx.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">{typeLabel(tx.type)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-muted-foreground">
                      {tx.description || "—"}
                    </td>
                    <td
                      className={
                        tx.amountCents < 0
                          ? "px-3 py-2.5 text-right tabular-nums text-destructive"
                          : "px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400"
                      }
                    >
                      {tx.amountCents > 0 ? "+" : ""}
                      {formatCents(tx.amountCents)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCents(tx.balanceAfterCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {wallet ? (
        <>
          <BuyCreditsDialog
            open={buyOpen}
            onOpenChange={setBuyOpen}
            wallet={wallet}
          />
          <AutoReloadDialog
            open={autoReloadOpen}
            onOpenChange={setAutoReloadOpen}
            wallet={wallet}
            onSaved={(next) => setWallet(next)}
          />
          <EditLimitDialog
            open={limitOpen}
            onOpenChange={setLimitOpen}
            kind="usage"
            wallet={wallet}
            onSaved={(next) => setWallet(next)}
          />
        </>
      ) : null}
    </div>
  );
}
