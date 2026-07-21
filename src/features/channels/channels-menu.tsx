"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ChannelRow = {
  id: string;
  name: string;
  connected: boolean;
  manageHref?: string;
};

type ChannelsCachePayload = {
  googleConnected: boolean;
  googleHref: string | undefined;
  fetchedAt: number;
};

const CHANNELS_CACHE_TTL_MS = 30_000;

/** Survives AppShell remounts across settings ↔ app navigations. */
let channelsCache: ChannelsCachePayload | null = null;

function readFreshChannelsCache(): ChannelsCachePayload | null {
  if (!channelsCache) return null;
  if (Date.now() - channelsCache.fetchedAt > CHANNELS_CACHE_TTL_MS) return null;
  return channelsCache;
}

function writeChannelsCache(
  payload: Omit<ChannelsCachePayload, "fetchedAt">,
) {
  channelsCache = { ...payload, fetchedAt: Date.now() };
}

const STATIC_CHANNELS: ChannelRow[] = [
  { id: "meta", name: "Meta", connected: false },
  { id: "tiktok", name: "TikTok Ads", connected: false },
  { id: "pinterest", name: "Pinterest", connected: false },
];

function scheduleIdle(fn: () => void): () => void {
  const ric = window.requestIdleCallback?.(fn, { timeout: 2000 });
  if (ric !== undefined) {
    return () => window.cancelIdleCallback?.(ric);
  }
  const timeout = window.setTimeout(fn, 300);
  return () => window.clearTimeout(timeout);
}

export function ChannelsMenu() {
  const cached = readFreshChannelsCache();
  const [googleConnected, setGoogleConnected] = useState(
    cached?.googleConnected ?? false,
  );
  const [googleHref, setGoogleHref] = useState<string | undefined>(
    cached?.googleHref,
  );
  const [loaded, setLoaded] = useState(Boolean(cached));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/google-ads/connections");
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      const body = (await res.json()) as {
        connections?: {
          id: string;
          status: string;
          externalAccountId: string | null;
        }[];
      };
      const active = (body.connections ?? []).filter(
        (c) => c.status === "active" && c.externalAccountId,
      );
      const nextConnected = active.length > 0;
      const nextHref = active[0]
        ? `/settings/connections/google-ads/${active[0].id}`
        : "/settings/connections";
      setGoogleConnected(nextConnected);
      setGoogleHref(nextHref);
      writeChannelsCache({
        googleConnected: nextConnected,
        googleHref: nextHref,
      });
    } catch {
      // Keep defaults when offline / unauthenticated.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (readFreshChannelsCache()) return;
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
    if (open && !readFreshChannelsCache()) {
      void refresh();
    }
  }

  const channels: ChannelRow[] = [
    {
      id: "google",
      name: "Google Ads",
      connected: googleConnected,
      manageHref: googleHref,
    },
    ...STATIC_CHANNELS,
  ];

  const connectedCount = channels.filter((c) => c.connected).length;

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="sm" className="text-xs text-neutral-400" />}
      >
        <span
          className={cn(
            "mr-0.5 font-mono tabular-nums",
            !loaded
              ? "text-muted-foreground"
              : connectedCount > 0
                ? "text-emerald-500"
                : "text-red-500",
          )}
        >
          {loaded ? connectedCount : "–"}
        </span>
        Channels
        <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-[color,transform] duration-200 group-hover/button:text-neutral-300 group-aria-expanded/button:rotate-180 group-aria-expanded/button:text-neutral-300" />
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-56 p-2">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
          Connected channels
        </p>
        <ul className="space-y-0.5">
          {channels.map((channel) => (
            <li key={channel.id}>
              {channel.manageHref && channel.connected ? (
                <Link
                  href={channel.manageHref}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60"
                >
                  <span className="flex-1">{channel.name}</span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                  >
                    Connected
                  </Badge>
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                  <span className="flex-1">{channel.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Not connected
                  </Badge>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Separator className="my-2" />
        <Link
          href="/settings/connections"
          className="block rounded-md px-1.5 py-1 text-sm hover:bg-muted/60"
        >
          Manage channels…
        </Link>
      </PopoverContent>
    </Popover>
  );
}
