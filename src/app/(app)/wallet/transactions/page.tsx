import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { redirect } from "next/navigation";
import type { WalletTransaction } from "@/domain";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/features/wallet/money";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { hasServiceRole } from "@/lib/supabase/service";
import { getWalletWriteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

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

export default async function WalletTransactionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const active = await getActiveWorkspace();
  if (!active) redirect("/");

  let transactions: WalletTransaction[] = [];
  let loadError: string | null = null;

  if (!hasServiceRole()) {
    loadError = "Wallet service is not configured.";
  } else {
    try {
      const repo = getWalletWriteRepository();
      await repo.ensureWallet(active.workspace.id);
      transactions = await repo.listTransactions(active.workspace.id, {
        limit: 100,
      });
    } catch (err) {
      loadError =
        err instanceof Error ? err.message : "Failed to load transactions";
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button
          render={<Link href="/" />}
          variant="ghost"
          size="sm"
          className="gap-1.5"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Button>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Transaction history
          </h1>
          <p className="text-sm text-muted-foreground">
            Credits, AI usage, and wallet activity for{" "}
            {active.workspace.name}.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No transactions yet. Buy credits from the wallet menu to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
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
    </div>
  );
}
