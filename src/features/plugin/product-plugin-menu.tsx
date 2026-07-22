"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  RefreshCwIcon,
  SettingsIcon,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PluginInstallStatus, PluginPingResult } from "@/lib/plugin/types";
import {
  installInstructionsFor,
  isPluginInstallPlatform,
  PLUGIN_INSTALL_PLATFORMS,
  type PluginInstallPlatform,
} from "@/features/plugin/install-platforms";
import { SnippetCode } from "@/features/plugin/snippet-highlight";

const FALLBACK_SNIPPET = `<script
  src="http://localhost:3001/v1/plugin.js"
  data-workspace="…"
  async
></script>`;

type PluginCachePayload = {
  snippet: string;
  status: PluginInstallStatus | null;
  primaryDomain: string | null;
  detectedProvider: PluginInstallPlatform | null;
  fetchedAt: number;
};

const PLUGIN_CACHE_TTL_MS = 30_000;

/** Survives AppShell remounts across settings ↔ app navigations. */
let pluginCache: PluginCachePayload | null = null;

function readFreshPluginCache(): PluginCachePayload | null {
  if (!pluginCache) return null;
  if (Date.now() - pluginCache.fetchedAt > PLUGIN_CACHE_TTL_MS) return null;
  return pluginCache;
}

function writePluginCache(payload: Omit<PluginCachePayload, "fetchedAt">) {
  pluginCache = { ...payload, fetchedAt: Date.now() };
}

function scheduleIdle(fn: () => void): () => void {
  const ric = window.requestIdleCallback?.(fn, { timeout: 2000 });
  if (ric !== undefined) {
    return () => window.cancelIdleCallback?.(ric);
  }
  const timeout = window.setTimeout(fn, 300);
  return () => window.clearTimeout(timeout);
}

function providerFromStatus(
  status: PluginInstallStatus | null,
): PluginInstallPlatform | null {
  const raw = status?.detected_provider;
  if (!raw) return null;
  return isPluginInstallPlatform(raw) ? raw : null;
}

export function ProductPluginMenu() {
  const cached = readFreshPluginCache();
  const [copied, setCopied] = useState(false);
  const [snippet, setSnippet] = useState(cached?.snippet ?? FALLBACK_SNIPPET);
  const [status, setStatus] = useState<PluginInstallStatus | null>(
    cached?.status ?? null,
  );
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(
    cached?.primaryDomain ?? null,
  );
  const [platform, setPlatform] = useState<PluginInstallPlatform>(
    cached?.detectedProvider ?? "custom",
  );
  const platformTouchedRef = useRef(false);
  const [pinging, setPinging] = useState(false);
  /** True only before the first successful status load — not during refreshes. */
  const [initialLoading, setInitialLoading] = useState(!cached?.status);

  const applyStatus = useCallback(
    (nextStatus: PluginInstallStatus | null, nextSnippet?: string) => {
      if (nextSnippet) setSnippet(nextSnippet);
      setStatus(nextStatus);
      if (nextStatus?.primary_domain !== undefined) {
        setPrimaryDomain(nextStatus.primary_domain);
      }
      const detected = providerFromStatus(nextStatus);
      if (detected && !platformTouchedRef.current) {
        setPlatform(detected);
      }
      setInitialLoading(false);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const [containerRes, statusRes] = await Promise.all([
        fetch("/api/plugin/container"),
        fetch("/api/plugin/container/install-status"),
      ]);

      const prior = pluginCache;
      let nextSnippet = prior?.snippet ?? FALLBACK_SNIPPET;
      let nextStatus = prior?.status ?? null;

      if (containerRes.ok) {
        const data = await containerRes.json();
        if (typeof data.installSnippet === "string" && data.installSnippet) {
          nextSnippet = data.installSnippet;
        }
      }

      if (statusRes.ok) {
        nextStatus = (await statusRes.json()) as PluginInstallStatus;
      }

      applyStatus(nextStatus, nextSnippet);
      writePluginCache({
        snippet: nextSnippet,
        status: nextStatus,
        primaryDomain: nextStatus?.primary_domain ?? prior?.primaryDomain ?? null,
        detectedProvider: providerFromStatus(nextStatus),
      });
    } catch {
      // Keep fallback snippet; status stays as-is.
      setInitialLoading(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    if (readFreshPluginCache()) return;
    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [refresh]);

  function handleOpenChange(open: boolean) {
    if (open && !readFreshPluginCache()) {
      void refresh();
    }
  }

  // Status circle: never flash muted during refresh if we already know status.
  const connected = Boolean(status?.has_ever_received);
  const statusUnknown = status === null && initialLoading;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Plugin snippet copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy snippet");
    }
  }

  async function pingPlugin() {
    setPinging(true);
    try {
      const res = await fetch("/api/plugin/container/ping", { method: "POST" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as PluginPingResult;
      applyStatus(data.status);
      writePluginCache({
        snippet,
        status: data.status,
        primaryDomain: data.status.primary_domain,
        detectedProvider: providerFromStatus(data.status),
      });

      if (data.ok && data.status.has_ever_received) {
        toast.success("Plugin connected", {
          description: `${data.status.last_hour_count} event${
            data.status.last_hour_count === 1 ? "" : "s"
          } in the last hour`,
        });
      } else if (data.ok) {
        toast.message("Plugin reachable", {
          description:
            "Script and container responded, but no events have been received yet.",
        });
      } else {
        toast.error("Plugin not connected", {
          description: data.error ?? "Could not reach the plugin service",
        });
      }
    } catch {
      toast.error("Couldn't ping plugin");
    } finally {
      setPinging(false);
    }
  }

  const domainLabel = primaryDomain?.trim() || "not set";

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-neutral-400"
          />
        }
      >
        <span
          className={cn(
            "mr-0.5 size-1.5 shrink-0 rounded-full",
            statusUnknown
              ? "bg-muted-foreground/40"
              : connected
                ? "bg-emerald-500"
                : "bg-red-500",
          )}
          aria-label={
            statusUnknown
              ? "Plugin status loading"
              : connected
                ? "Plugin connected"
                : "Plugin not connected"
          }
        />
        Plugin
        <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-[color,transform] duration-200 group-hover/button:text-neutral-300 group-aria-expanded/button:rotate-180 group-aria-expanded/button:text-neutral-300" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
        <div className="relative space-y-3 p-3 pt-2.5">
          <div className="absolute top-2 right-2">
            <Tooltip>
              <TooltipTrigger
                delay={50}
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Manage plugin"
                    className="text-muted-foreground"
                    render={<Link href="/settings/plugin" />}
                  />
                }
              >
                <SettingsIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                Manage plugin
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="pr-8 text-xs text-muted-foreground">
            For use on:{" "}
            <span className="font-medium text-foreground">{domainLabel}</span>
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Platform
            </label>
            <Select
              value={platform}
              onValueChange={(value) => {
                if (!value || !isPluginInstallPlatform(value)) return;
                platformTouchedRef.current = true;
                setPlatform(value);
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                {PLUGIN_INSTALL_PLATFORMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {installInstructionsFor(platform)}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-end">
              <Tooltip>
                <TooltipTrigger
                  delay={50}
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={copied ? "Copied" : "Copy snippet"}
                      onClick={copySnippet}
                    />
                  }
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  {copied ? "Copied" : "Copy snippet"}
                </TooltipContent>
              </Tooltip>
            </div>
            <SnippetCode code={snippet} />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={pinging}
            onClick={() => void pingPlugin()}
          >
            {pinging ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {pinging ? "Checking…" : "Check connection"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
