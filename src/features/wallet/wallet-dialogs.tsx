"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { WalletSummary } from "@/domain";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { dollarsToCents, formatCents, parseDollarsInput } from "./money";

type LimitKind = "ad_spend" | "usage";

export function EditLimitDialog({
  open,
  onOpenChange,
  kind,
  wallet,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LimitKind;
  wallet: WalletSummary;
  onSaved: (wallet: WalletSummary) => void;
}) {
  const current =
    kind === "ad_spend" ? wallet.adSpendLimitCents : wallet.usageLimitCents;
  const [value, setValue] = useState(
    current == null ? "" : String(current / 100),
  );
  const [saving, setSaving] = useState(false);

  const title =
    kind === "ad_spend" ? "Edit spend limit" : "Edit usage limit";
  const description =
    kind === "ad_spend"
      ? "Set a monthly ad spend limit for this workspace."
      : "Set a monthly hard cap for platform AI usage.";

  async function save() {
    const dollars = value.trim() === "" ? null : parseDollarsInput(value);
    if (value.trim() !== "" && dollars == null) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const body =
        kind === "ad_spend"
          ? { adSpendLimitCents: dollars == null ? null : dollarsToCents(dollars) }
          : { usageLimitCents: dollars == null ? null : dollarsToCents(dollars) };
      const res = await fetch("/api/wallet/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        wallet?: WalletSummary;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to save limit");
      if (data.wallet) onSaved(data.wallet);
      toast.success("Limit updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue(current == null ? "" : String(current / 100));
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="monthly-limit">Monthly limit (USD)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="monthly-limit"
              inputMode="decimal"
              placeholder={kind === "usage" ? "No limit" : "0"}
              className="pl-7"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {kind === "usage" ? (
            <p className="text-xs text-muted-foreground">
              Hard cap. AI requests are blocked once this limit is reached for
              the billing period.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BuyCreditsDialog({
  open,
  onOpenChange,
  wallet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletSummary;
}) {
  const [amount, setAmount] = useState("250");
  const [autoReload, setAutoReload] = useState(false);
  const [busy, setBusy] = useState(false);

  const dollars = parseDollarsInput(amount);
  const cents = dollars == null ? 0 : dollarsToCents(dollars);
  const valid = cents >= 500 && cents <= 20_000_000;

  async function buy() {
    if (!valid) {
      toast.error("Enter an amount between $5 and $200,000");
      return;
    }
    setBusy(true);
    try {
      if (autoReload && wallet.canManage) {
        // Persist intent after purchase; user still needs a payment method.
        // Checkout will collect/save the card via setup_future_usage.
      }
      const res = await fetch("/api/wallet/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to start checkout");
      }
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
          <DialogDescription>
            Credits are charged to your default payment method and applied
            immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="credits-amount">Credits</Label>
              <span className="text-xs text-muted-foreground">
                Enter an amount between $5 and $200,000
              </span>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="credits-amount"
                inputMode="decimal"
                className="pl-7"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Auto-reload credits</p>
              <p className="text-xs text-muted-foreground">
                Avoid service disruptions by auto-reloading credits when your
                balance reaches a specified minimum.
                {!wallet.hasPaymentMethod
                  ? " Add a payment method first to enable auto-reload."
                  : ""}
              </p>
            </div>
            <Switch
              checked={autoReload}
              disabled={!wallet.hasPaymentMethod}
              onCheckedChange={setAutoReload}
            />
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{valid ? formatCents(cents) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated taxes</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{valid ? formatCents(cents) : "—"}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={!valid || busy || !wallet.canManage}
            onClick={() => void buy()}
          >
            {busy
              ? "Redirecting…"
              : valid
                ? `Buy ${formatCents(cents)} of credits`
                : "Buy credits"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Credits are consumed as you run campaigns and AI. You&apos;ll be
            redirected to Stripe to complete your purchase.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutoReloadDialog({
  open,
  onOpenChange,
  wallet,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletSummary;
  onSaved: (wallet: WalletSummary) => void;
}) {
  const [threshold, setThreshold] = useState(
    String((wallet.autoReloadThresholdCents ?? 1000) / 100),
  );
  const [target, setTarget] = useState(
    String((wallet.autoReloadTargetCents ?? 5000) / 100),
  );
  const [saving, setSaving] = useState(false);

  async function turnOn() {
    const thresholdDollars = parseDollarsInput(threshold);
    const targetDollars = parseDollarsInput(target);
    if (thresholdDollars == null || targetDollars == null) {
      toast.error("Enter valid amounts");
      return;
    }
    const thresholdCents = dollarsToCents(thresholdDollars);
    const targetCents = dollarsToCents(targetDollars);
    if (targetCents <= thresholdCents) {
      toast.error("Target must be greater than the threshold");
      return;
    }
    if (!wallet.hasPaymentMethod) {
      toast.error("Add a payment method first");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/wallet/auto-reload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          thresholdCents,
          targetCents,
        }),
      });
      const data = (await res.json()) as {
        wallet?: WalletSummary;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to enable auto-reload");
      if (data.wallet) onSaved(data.wallet);
      toast.success("Auto-reload enabled");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setThreshold(String((wallet.autoReloadThresholdCents ?? 1000) / 100));
          setTarget(String((wallet.autoReloadTargetCents ?? 5000) / 100));
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up auto-reload</DialogTitle>
          <DialogDescription>
            Avoid service disruptions by automatically topping up credits when
            your balance runs low.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ar-threshold">When credit balance reaches:</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="ar-threshold"
                className="pl-7"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-target">Bring balance back up to:</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="ar-target"
                className="pl-7"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>
          {!wallet.hasPaymentMethod ? (
            <p className="text-xs text-muted-foreground">
              No payment method on file. Add one from the credit balance card
              first.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            disabled={saving || !wallet.hasPaymentMethod || !wallet.canManage}
            onClick={() => void turnOn()}
          >
            {saving ? "Saving…" : "Turn on"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
