"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPT_OUT_KEY = "__product_optout";

type InstallStatus = {
  has_ever_received: boolean;
  last_event_at: string | null;
  last_event_type: string | null;
  last_event_name: string | null;
  last_hour_count: number;
  last_day_count: number;
};

type InstallPanelProps = {
  statusUrl: string;
  installSnippet: string;
  /**
   * Which sections to render. `'all'` (default) shows the full panel; the
   * other values let callers split the panel into two distinct popovers
   * (install snippet + status vs. opt-out).
   */
  section?: "all" | "install" | "opt_out";
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function InstallPanel({
  statusUrl,
  installSnippet,
  section = "all",
}: InstallPanelProps) {
  const showInstall = section === "all" || section === "install";
  const showOptOut = section === "all" || section === "opt_out";

  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [optOut, setOptOut] = useState<boolean | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!statusUrl) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(statusUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to fetch status");
    } finally {
      setStatusLoading(false);
    }
  }, [statusUrl]);

  useEffect(() => {
    void refreshStatus();
    if (!statusUrl) return;
    const id = window.setInterval(refreshStatus, 30_000);
    return () => window.clearInterval(id);
  }, [refreshStatus, statusUrl]);

  useEffect(() => {
    try {
      setOptOut(window.localStorage.getItem(OPT_OUT_KEY) === "1");
    } catch {
      setOptOut(null);
    }
  }, []);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setCopied(true);
      toast.success("Install snippet copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy snippet");
    }
  }

  function setOptOutLocally(value: boolean) {
    try {
      if (value) window.localStorage.setItem(OPT_OUT_KEY, "1");
      else window.localStorage.removeItem(OPT_OUT_KEY);
      setOptOut(value);
      toast.success(value ? "Tracking blocked on this domain" : "Tracking re-enabled");
    } catch {
      toast.error("Couldn't update opt-out");
    }
  }

  return (
    <div className="space-y-4">
      {showInstall && (
        <>
          <section className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Install snippet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paste this in the <code className="rounded bg-muted px-1 py-0.5">&lt;head&gt;</code> of every
                page on your site. One install covers all tags and triggers configured here.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
              {installSnippet}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={copySnippet}
            >
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy snippet"}
            </Button>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Install status</p>
              <button
                type="button"
                onClick={() => refreshStatus()}
                disabled={statusLoading}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <RefreshCwIcon className={cn("size-3", statusLoading && "animate-spin")} />
                {statusLoading ? "Checking…" : "Refresh"}
              </button>
            </div>

            {statusError ? (
              <div className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                {statusError}
              </div>
            ) : !status ? (
              <div className="text-xs text-muted-foreground">Checking…</div>
            ) : !status.has_ever_received ? (
              <div className="rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                <div className="font-medium">No events received yet</div>
                <div className="mt-0.5 text-[11px] opacity-90">
                  Once the snippet is installed and visitors load the site, events will land here
                  within ~1 minute.
                </div>
              </div>
            ) : status.last_hour_count > 0 ? (
              <div className="rounded-md bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  Live — {status.last_hour_count.toLocaleString()} event
                  {status.last_hour_count === 1 ? "" : "s"} in the last hour
                </div>
                <div className="mt-0.5 text-[11px] opacity-90">
                  {status.last_day_count.toLocaleString()} in last 24h · last seen{" "}
                  {timeAgo(status.last_event_at)}
                  {status.last_event_type
                    ? ` (${status.last_event_type}${
                        status.last_event_name ? `: ${status.last_event_name}` : ""
                      })`
                    : null}
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted px-2.5 py-2 text-xs text-foreground">
                <div className="font-medium">Quiet right now</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {status.last_day_count.toLocaleString()} in last 24h · last seen{" "}
                  {timeAgo(status.last_event_at)}. No events in the last hour.
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {showOptOut && (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Block your own tracking</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Opt out of tracking on this domain from your own browser. The flag is stored in{" "}
              <code className="rounded bg-muted px-1 py-0.5">localStorage</code> per origin and
              honored by the plugin.
            </p>
          </div>

          {optOut !== null && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2.5 py-2">
              <div className="text-xs">
                <div className="font-medium text-foreground">
                  On this domain{typeof window !== "undefined" ? ` (${window.location.host})` : ""}:
                </div>
                <div
                  className={cn(
                    "text-[11px]",
                    optOut ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {optOut ? "Opted out — no events from your browser" : "Tracking enabled"}
                </div>
              </div>
              <Button
                type="button"
                variant={optOut ? "outline" : "secondary"}
                size="sm"
                onClick={() => setOptOutLocally(!optOut)}
              >
                {optOut ? "Re-enable" : "Opt out"}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
