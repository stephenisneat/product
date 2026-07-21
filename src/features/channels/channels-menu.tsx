"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronDownIcon, SearchIcon, SettingsIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  COMING_SOON_CHANNELS,
  LIVE_CHANNELS,
  channelLogoUrl,
  type ChannelCatalogEntry,
} from "./channel-catalog";
import { SuggestChannelDialog } from "./suggest-channel-dialog";

type LiveChannelState = {
  id: string;
  name: string;
  logoSlug: string;
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

function scheduleIdle(fn: () => void): () => void {
  const ric = window.requestIdleCallback?.(fn, { timeout: 2000 });
  if (ric !== undefined) {
    return () => window.cancelIdleCallback?.(ric);
  }
  const timeout = window.setTimeout(fn, 300);
  return () => window.clearTimeout(timeout);
}

function matchesQuery(name: string, query: string) {
  if (!query) return true;
  return name.toLowerCase().includes(query.toLowerCase());
}

function ChannelLogo({
  name,
  logoSlug,
}: {
  name: string;
  logoSlug: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-medium text-muted-foreground"
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- simpleicons CDN brand marks
    <img
      src={channelLogoUrl(logoSlug)}
      alt=""
      width={16}
      height={16}
      className="size-4 shrink-0 dark:invert"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1.5 pt-1.5 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
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
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

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
    setMenuOpen(open);
    if (open && !readFreshChannelsCache()) {
      void refresh();
    }
    if (!open) setQuery("");
  }

  const liveChannels: LiveChannelState[] = useMemo(() => {
    return LIVE_CHANNELS.map((channel) => {
      if (channel.id === "google") {
        return {
          ...channel,
          connected: googleConnected,
          manageHref: googleHref ?? "/settings/connections",
        };
      }
      return { ...channel, connected: false };
    });
  }, [googleConnected, googleHref]);

  const connected = liveChannels.filter(
    (c) => c.connected && matchesQuery(c.name, query),
  );
  const notConnected = liveChannels.filter(
    (c) => !c.connected && matchesQuery(c.name, query),
  );
  const comingSoon = COMING_SOON_CHANNELS.filter((c) =>
    matchesQuery(c.name, query),
  );

  const connectedCount = liveChannels.filter((c) => c.connected).length;
  const noMatches =
    connected.length === 0 &&
    notConnected.length === 0 &&
    comingSoon.length === 0;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={handleOpenChange}>
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
        <PopoverContent align="start" className="w-80 p-2">
          <div className="flex items-center gap-1.5 px-0.5 pb-1.5">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels…"
                className="h-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                aria-label="Search channels"
              />
            </div>
            <Button
              render={<Link href="/settings/connections" />}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Channel settings"
            >
              <SettingsIcon className="size-3.5" />
            </Button>
          </div>

          <ScrollArea className="h-72">
            {noMatches ? (
              <p className="px-1.5 py-3 text-sm text-muted-foreground">
                No matching channels
              </p>
            ) : (
              <div className="pr-2">
                {connected.length > 0 ? (
                  <div>
                    <GroupLabel>Connected</GroupLabel>
                    <ul className="space-y-0.5">
                      {connected.map((channel) => (
                        <li key={channel.id}>
                          <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                            <ChannelLogo
                              name={channel.name}
                              logoSlug={channel.logoSlug}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {channel.name}
                            </span>
                            <Button
                              render={
                                <Link
                                  href={
                                    channel.manageHref ??
                                    "/settings/connections"
                                  }
                                />
                              }
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${channel.name} settings`}
                              className="shrink-0"
                            >
                              <SettingsIcon className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {notConnected.length > 0 ? (
                  <div>
                    <GroupLabel>Not connected</GroupLabel>
                    <ul className="space-y-0.5">
                      {notConnected.map((channel) => (
                        <li key={channel.id}>
                          <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                            <ChannelLogo
                              name={channel.name}
                              logoSlug={channel.logoSlug}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {channel.name}
                            </span>
                            <Button
                              render={<Link href="/settings/connections" />}
                              type="button"
                              variant="outline"
                              size="xs"
                              className="shrink-0"
                            >
                              Connect
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {comingSoon.length > 0 ? (
                  <div>
                    <GroupLabel>Coming soon</GroupLabel>
                    <ul className="space-y-0.5">
                      {comingSoon.map((channel: ChannelCatalogEntry) => (
                        <li key={channel.id}>
                          <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground">
                            <ChannelLogo
                              name={channel.name}
                              logoSlug={channel.logoSlug}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {channel.name}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </ScrollArea>

          <Separator className="my-2" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              setMenuOpen(false);
              setSuggestOpen(true);
            }}
          >
            Missing something?
          </Button>
        </PopoverContent>
      </Popover>

      <SuggestChannelDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </>
  );
}
