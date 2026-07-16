"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  CreditCardIcon,
  FileTextIcon,
  MegaphoneIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { WalletSummary } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@/features/wallet/wallet-context";
import {
  AutoReloadDialog,
  EditLimitDialog,
} from "@/features/wallet/wallet-dialogs";
import { formatCents } from "@/features/wallet/money";

function ProgressBar({ value, max }: { value: number; max: number | null }) {
  const pct =
    max == null || max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/70 transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function WalletPopoverShell({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function WalletUnavailable({ loading }: { loading: boolean }) {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      {loading ? "Loading wallet…" : "Wallet unavailable"}
    </div>
  );
}

function AdSpendLimitMenu({
  wallet,
  loading,
  onChangeLimit,
}: {
  wallet: WalletSummary | null;
  loading: boolean;
  onChangeLimit: () => void;
}) {
  const triggerLabel = !wallet
    ? "…"
    : wallet.adSpendLimitCents != null
      ? `${formatCents(wallet.adSpendMtdCents)} / ${formatCents(wallet.adSpendLimitCents)}`
      : formatCents(wallet.adSpendMtdCents);

  return (
    <WalletPopoverShell
      trigger={
        <>
          <MegaphoneIcon data-icon="inline-start" />
          {loading && !wallet ? "…" : triggerLabel}
        </>
      }
    >
      {!wallet ? (
        <WalletUnavailable loading={loading} />
      ) : (
        <section className="space-y-3 p-3">
          <div>
            <p className="text-sm font-medium">Monthly ad spend limit</p>
            <p className="text-xs text-muted-foreground">
              Maximum ad spend for this billing period.
            </p>
          </div>
          <ProgressBar
            value={wallet.adSpendMtdCents}
            max={wallet.adSpendLimitCents}
          />
          <p className="font-heading text-lg font-semibold tracking-tight">
            {formatCents(wallet.adSpendMtdCents)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              spent this month
              {wallet.adSpendLimitCents != null
                ? ` of ${formatCents(wallet.adSpendLimitCents)}`
                : ""}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Resets on {wallet.resetsOn}
            </p>
            {wallet.canManage ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onChangeLimit}
              >
                Change limit
              </Button>
            ) : null}
          </div>
        </section>
      )}
    </WalletPopoverShell>
  );
}

function UsageLimitMenu({
  wallet,
  loading,
  onChangeLimit,
}: {
  wallet: WalletSummary | null;
  loading: boolean;
  onChangeLimit: () => void;
}) {
  const triggerLabel = !wallet
    ? "…"
    : wallet.usageLimitCents != null
      ? `${formatCents(wallet.usageMtdCents)} / ${formatCents(wallet.usageLimitCents)}`
      : formatCents(wallet.usageMtdCents);

  return (
    <WalletPopoverShell
      trigger={
        <>
          <SparklesIcon data-icon="inline-start" />
          {loading && !wallet ? "…" : triggerLabel}
        </>
      }
    >
      {!wallet ? (
        <WalletUnavailable loading={loading} />
      ) : (
        <section className="space-y-3 p-3">
          <div>
            <p className="text-sm font-medium">Monthly usage limit</p>
            <p className="text-xs text-muted-foreground">
              Platform AI events for this billing period.
            </p>
          </div>
          <ProgressBar
            value={wallet.usageMtdCents}
            max={wallet.usageLimitCents}
          />
          <p className="font-heading text-lg font-semibold tracking-tight">
            {formatCents(wallet.usageMtdCents)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              used this month
              {wallet.usageLimitCents != null
                ? ` of ${formatCents(wallet.usageLimitCents)}`
                : ""}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Resets on {wallet.resetsOn}
            </p>
            {wallet.canManage ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onChangeLimit}
              >
                Change limit
              </Button>
            ) : null}
          </div>
        </section>
      )}
    </WalletPopoverShell>
  );
}

function CreditBalanceMenu({
  wallet,
  loading,
  onAutoReload,
  onBuyCredits,
}: {
  wallet: WalletSummary | null;
  loading: boolean;
  onAutoReload: () => void;
  onBuyCredits: () => void;
}) {
  const [portalBusy, setPortalBusy] = useState(false);

  async function openPortal() {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/wallet/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to open payment methods");
      }
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Portal failed");
      setPortalBusy(false);
    }
  }

  const balanceLabel = wallet
    ? formatCents(wallet.balanceCents, wallet.currency)
    : "…";

  return (
    <WalletPopoverShell
      trigger={
        <>
          <WalletIcon data-icon="inline-start" />
          {loading && !wallet ? "…" : balanceLabel}
        </>
      }
    >
      {!wallet ? (
        <WalletUnavailable loading={loading} />
      ) : (
        <div>
          <section className="space-y-3 p-3">
            <div>
              <p className="text-sm font-medium">Credit balance</p>
              <p className="text-xs text-muted-foreground">
                Top up directly or set up auto-reload to keep campaigns running.
              </p>
            </div>
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">
                {formatCents(wallet.balanceCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                Remaining balance
                {wallet.canManage ? (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={onAutoReload}
                    >
                      {wallet.autoReloadEnabled
                        ? "Edit auto-reload"
                        : "Set up auto-reload"}
                    </button>
                  </>
                ) : null}
              </p>
            </div>
            {wallet.canManage ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={portalBusy}
                  onClick={() => void openPortal()}
                >
                  <CreditCardIcon data-icon="inline-start" />
                  Payment methods
                </Button>
                <Button type="button" size="xs" onClick={onBuyCredits}>
                  Buy credits
                </Button>
              </div>
            ) : null}
          </section>

          <Separator />

          <Link
            href="/wallet/transactions"
            className="flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
              <FileTextIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Transaction history
              </span>
              <span className="block text-xs text-muted-foreground">
                Credits, AI usage, and wallet activity.
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      )}
    </WalletPopoverShell>
  );
}

/** Three toolbar popovers: ad spend, usage, and credit balance. */
export function WalletMenu() {
  const { wallet, loading, setWallet, setOpenBuyCredits } = useWallet();
  const [spendOpen, setSpendOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [autoReloadOpen, setAutoReloadOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("wallet");
    if (flag === "credits_added") {
      toast.success("Credits added to your wallet");
      params.delete("wallet");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    } else if (flag === "cancelled") {
      toast.message("Checkout cancelled");
      params.delete("wallet");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    }
  }, []);

  return (
    <>
      <AdSpendLimitMenu
        wallet={wallet}
        loading={loading}
        onChangeLimit={() => setSpendOpen(true)}
      />
      <UsageLimitMenu
        wallet={wallet}
        loading={loading}
        onChangeLimit={() => setUsageOpen(true)}
      />
      <CreditBalanceMenu
        wallet={wallet}
        loading={loading}
        onAutoReload={() => setAutoReloadOpen(true)}
        onBuyCredits={() => setOpenBuyCredits(true)}
      />

      {wallet ? (
        <>
          <EditLimitDialog
            open={spendOpen}
            onOpenChange={setSpendOpen}
            kind="ad_spend"
            wallet={wallet}
            onSaved={setWallet}
          />
          <EditLimitDialog
            open={usageOpen}
            onOpenChange={setUsageOpen}
            kind="usage"
            wallet={wallet}
            onSaved={setWallet}
          />
          <AutoReloadDialog
            open={autoReloadOpen}
            onOpenChange={setAutoReloadOpen}
            wallet={wallet}
            onSaved={setWallet}
          />
        </>
      ) : null}
    </>
  );
}
