import { redirect } from "next/navigation";
import type { WalletTransaction } from "@/domain";
import { WalletSettingsPanel } from "@/features/wallet/wallet-settings-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { hasServiceRole } from "@/lib/supabase/service";
import { getWalletWriteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export default async function WalletSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/wallet");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

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
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Wallet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits, usage limits, and transaction history for{" "}
          {active.workspace.name}.
        </p>
      </div>

      <WalletSettingsPanel
        workspaceName={active.workspace.name}
        transactions={transactions}
        loadError={loadError}
      />
    </div>
  );
}
