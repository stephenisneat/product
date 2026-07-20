"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CreditCardIcon,
  FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { MemberUsage, WalletSummary } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@/features/wallet/wallet-context";
import { MemberUsageList } from "@/features/wallet/member-usage-list";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { formatCents, formatCentsFloorDollars } from "@/features/wallet/money";
import { cn } from "@/lib/utils";

const EditLimitDialog = dynamic(
  () =>
    import("@/features/wallet/wallet-dialogs").then((m) => m.EditLimitDialog),
  { ssr: false },
);

const AutoReloadDialog = dynamic(
  () =>
    import("@/features/wallet/wallet-dialogs").then((m) => m.AutoReloadDialog),
  { ssr: false },
);

/** Remaining capacity below this is treated as "getting low". */
const RING_LOW_PCT = 20;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function usagePercent(value: number, max: number | null): number {
  if (max == null || max <= 0) return 0;
  return clampPercent((value / max) * 100);
}

/** Remaining headroom for a monthly limit (100 = unused, 0 = exhausted). */
function limitRemainingPercent(used: number, limit: number | null): number {
  if (limit == null || limit <= 0) return 100;
  return clampPercent(((limit - used) / limit) * 100);
}

/** Balance fullness vs auto-reload target (or healthy if no target). */
function balanceRemainingPercent(
  balance: number,
  target: number | null,
): number {
  if (balance <= 0) return 0;
  if (target == null || target <= 0) return 100;
  return clampPercent((balance / target) * 100);
}

function ringToneClass(remainingPct: number): string {
  if (remainingPct < RING_LOW_PCT) return "text-amber-500";
  return "text-emerald-500";
}

/** Green / yellow / red for the balance toolbar amount. */
function balanceToneClass(remainingPct: number): string {
  if (remainingPct <= 0) return "text-red-500";
  if (remainingPct < RING_LOW_PCT) return "text-amber-500";
  return "text-emerald-500";
}

function ProgressBar({ value, max }: { value: number; max: number | null }) {
  const pct = Math.round(usagePercent(value, max));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/70 transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Compact circular progress for toolbar triggers (fill = remaining). */
function ProgressRing({
  remainingPct,
  className,
  "aria-label": ariaLabel,
}: {
  remainingPct: number;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = clampPercent(remainingPct);

  if (pct <= 0) {
    return (
      <CircleAlertIcon
        className={cn("size-3.5 shrink-0 text-red-500", className)}
        aria-label={ariaLabel}
      />
    );
  }

  const size = 14;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 -rotate-90", className)}
      aria-label={ariaLabel}
      role="img"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-muted-foreground/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn(
          "transition-[stroke-dashoffset,color] duration-300",
          ringToneClass(pct),
        )}
      />
    </svg>
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
        render={<Button type="button" variant="ghost" size="sm" />}
      >
        {trigger}
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
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
  locked,
}: {
  wallet: WalletSummary | null;
  loading: boolean;
  onChangeLimit: () => void;
  locked?: boolean;
}) {
  return (
    <WalletPopoverShell
      trigger={
        <>
          <ProgressRing
            remainingPct={limitRemainingPercent(
              wallet?.adSpendMtdCents ?? 0,
              wallet?.adSpendLimitCents ?? null,
            )}
            aria-label="Ad spend limit progress"
            className="mr-0.5"
          />
          {loading && !wallet ? "…" : "Ad spend"}
        </>
      }
    >
      {!wallet ? (
        <WalletUnavailable loading={loading} />
      ) : locked ? (
        <section className="space-y-3 p-3">
          <div>
            <p className="text-sm font-medium">Ad spend locked</p>
            <p className="text-xs text-muted-foreground">
              Adding ad spend requires Growth or Pro.
            </p>
          </div>
          <UpgradeButton type="button" size="xs" variant="outline">
            Upgrade
          </UpgradeButton>
        </section>
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
  memberUsage,
  currentUserId,
}: {
  wallet: WalletSummary | null;
  loading: boolean;
  onChangeLimit: () => void;
  memberUsage: MemberUsage[];
  currentUserId: string | null;
}) {
  return (
    <WalletPopoverShell
      trigger={
        <>
          <ProgressRing
            remainingPct={limitRemainingPercent(
              wallet?.usageMtdCents ?? 0,
              wallet?.usageLimitCents ?? null,
            )}
            aria-label="Usage limit progress"
            className="mr-0.5"
          />
          {loading && !wallet ? "…" : "Usage"}
        </>
      }
    >
      {!wallet ? (
        <WalletUnavailable loading={loading} />
      ) : (
        <div>
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

          <Separator />

          <section className="space-y-3 p-3">
            <div>
              <p className="text-sm font-medium">Usage by member</p>
              <p className="text-xs text-muted-foreground">
                How much each person has used this month.
              </p>
            </div>
            <MemberUsageList
              members={memberUsage}
              currentUserId={currentUserId}
              totalUsageCents={wallet.usageMtdCents}
            />
          </section>
        </div>
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

  const remainingPct = balanceRemainingPercent(
    wallet?.balanceCents ?? 0,
    wallet?.autoReloadTargetCents ?? null,
  );

  return (
    <WalletPopoverShell
      trigger={
        <>
          <span
            className={cn(
              "mr-0.5 font-mono tabular-nums",
              loading && !wallet
                ? "text-muted-foreground"
                : balanceToneClass(remainingPct),
            )}
          >
            {loading && !wallet
              ? "…"
              : formatCentsFloorDollars(wallet?.balanceCents ?? 0)}
          </span>
          Balance
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
            href="/settings/wallet"
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
  const {
    wallet,
    memberUsage,
    currentUserId,
    plan,
    loading,
    setWallet,
    setOpenBuyCredits,
  } = useWallet();
  const [spendOpen, setSpendOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [autoReloadOpen, setAutoReloadOpen] = useState(false);
  const adSpendLocked = plan === "free";

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
        locked={adSpendLocked}
        onChangeLimit={() => setSpendOpen(true)}
      />
      <UsageLimitMenu
        wallet={wallet}
        loading={loading}
        onChangeLimit={() => setUsageOpen(true)}
        memberUsage={memberUsage}
        currentUserId={currentUserId}
      />
      <CreditBalanceMenu
        wallet={wallet}
        loading={loading}
        onAutoReload={() => setAutoReloadOpen(true)}
        onBuyCredits={() => setOpenBuyCredits(true)}
      />

      {wallet ? (
        <>
          {!adSpendLocked && spendOpen ? (
            <EditLimitDialog
              open={spendOpen}
              onOpenChange={setSpendOpen}
              kind="ad_spend"
              wallet={wallet}
              onSaved={setWallet}
            />
          ) : null}
          {usageOpen ? (
            <EditLimitDialog
              open={usageOpen}
              onOpenChange={setUsageOpen}
              kind="usage"
              wallet={wallet}
              onSaved={setWallet}
            />
          ) : null}
          {autoReloadOpen ? (
            <AutoReloadDialog
              open={autoReloadOpen}
              onOpenChange={setAutoReloadOpen}
              wallet={wallet}
              onSaved={setWallet}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
