"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PluginListItem, PluginPingResult } from "@/lib/plugin/types";
import {
  installInstructionsFor,
  isPluginInstallPlatform,
  platformLabel,
} from "@/features/plugin/install-platforms";
import { CreatePluginDialog } from "@/features/plugin/create-plugin-dialog";
import { SnippetCode } from "@/features/plugin/snippet-highlight";

const FALLBACK_SNIPPET = `<script
  src="http://localhost:3001/v1/plugin.js"
  data-plugin="…"
  async
></script>`;

type PluginCachePayload = {
  plugins: PluginListItem[];
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

function writePluginCache(plugins: PluginListItem[]) {
  pluginCache = { plugins, fetchedAt: Date.now() };
}

function scheduleIdle(fn: () => void): () => void {
  const ric = window.requestIdleCallback?.(fn, { timeout: 2000 });
  if (ric !== undefined) {
    return () => window.cancelIdleCallback?.(ric);
  }
  const timeout = window.setTimeout(fn, 300);
  return () => window.clearTimeout(timeout);
}

function PluginAccordionPanel({
  item,
  onStatus,
}: {
  item: PluginListItem;
  onStatus: (pluginId: string, status: PluginListItem["status"]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pinging, setPinging] = useState(false);
  const platform = isPluginInstallPlatform(item.container.platform)
    ? item.container.platform
    : "custom";
  const domainLabel = item.container.domain?.trim() || "not set";
  const snippet = item.installSnippet || FALLBACK_SNIPPET;

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
      const res = await fetch(
        `/api/plugin/containers/${item.container.id}/ping`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PluginPingResult;
      onStatus(item.container.id, data.status);

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

  return (
    <div className="space-y-3 px-4 pb-1">
      <p className="text-xs text-muted-foreground">
        For use on:{" "}
        <span className="font-medium text-foreground">{domainLabel}</span>
      </p>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          {platformLabel(platform)}
        </p>
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
                  onClick={() => void copySnippet()}
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

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          render={<Link href={`/settings/plugin/${item.container.id}`} />}
        >
          Manage
        </Button>
      </div>
    </div>
  );
}

export function ProductPluginMenu() {
  const cached = readFreshPluginCache();
  const [plugins, setPlugins] = useState<PluginListItem[]>(
    cached?.plugins ?? [],
  );
  const [initialLoading, setInitialLoading] = useState(!cached);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/plugin/containers");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plugins?: PluginListItem[] };
      const next = Array.isArray(data.plugins) ? data.plugins : [];
      setPlugins(next);
      writePluginCache(next);
    } catch {
      // Keep prior list on failure.
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (readFreshPluginCache()) {
      setInitialLoading(false);
      return;
    }
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

  function applyStatus(
    pluginId: string,
    status: PluginListItem["status"],
  ) {
    setPlugins((prev) => {
      const next = prev.map((item) =>
        item.container.id === pluginId ? { ...item, status } : item,
      );
      writePluginCache(next);
      return next;
    });
  }

  function handleCreated(item: PluginListItem) {
    setPlugins((prev) => {
      const next = [...prev, item];
      writePluginCache(next);
      return next;
    });
    setExpanded([item.container.id]);
  }

  const anyConnected = plugins.some((p) => p.status.has_ever_received);
  const statusUnknown = initialLoading && plugins.length === 0;

  return (
    <>
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
                : plugins.length === 0
                  ? "bg-muted-foreground/40"
                  : anyConnected
                    ? "bg-emerald-500"
                    : "bg-red-500",
            )}
            aria-label={
              statusUnknown
                ? "Plugin status loading"
                : plugins.length === 0
                  ? "No plugins"
                  : anyConnected
                    ? "At least one plugin connected"
                    : "Plugins not connected"
            }
          />
          Plugin
          <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-[color,transform] duration-200 group-hover/button:text-neutral-300 group-aria-expanded/button:rotate-180 group-aria-expanded/button:text-neutral-300" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22rem] p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-xs font-medium text-foreground">Plugins</p>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  delay={50}
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Add plugin"
                      className="text-muted-foreground"
                      onClick={() => setCreateOpen(true)}
                    />
                  }
                >
                  <PlusIcon />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  Add plugin
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  delay={50}
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Manage plugins"
                      className="text-muted-foreground"
                      render={<Link href="/settings/plugin" />}
                    />
                  }
                >
                  <SettingsIcon />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  Manage plugins
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {initialLoading && plugins.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : plugins.length === 0 ? (
            <div className="space-y-3 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No plugins yet. Create one for each site or app you want to
                instrument.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon data-icon="inline-start" />
                New plugin
              </Button>
            </div>
          ) : (
            <Accordion
              multiple
              value={expanded}
              onValueChange={(value) => {
                setExpanded(Array.isArray(value) ? value : []);
              }}
            >
              {plugins.map((item) => {
                const connected = item.status.has_ever_received;
                return (
                  <AccordionItem key={item.container.id} value={item.container.id}>
                    <AccordionTrigger className="px-3 text-xs">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          connected ? "bg-emerald-500" : "bg-red-500",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.container.name}
                      </span>
                      <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                        {platformLabel(item.container.platform)}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      <PluginAccordionPanel
                        item={item}
                        onStatus={applyStatus}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </PopoverContent>
      </Popover>

      <CreatePluginDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
