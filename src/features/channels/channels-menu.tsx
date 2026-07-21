"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDownIcon,
  LifebuoyIcon,
  SearchIcon,
  SettingsIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  COMING_SOON_CHANNELS,
  LIVE_CHANNELS,
  channelLogoUrl,
  type ChannelCatalogEntry,
} from "./channel-catalog";
import { SuggestChannelDialog } from "./suggest-channel-dialog";

type LiveChannelState = ChannelCatalogEntry & {
  connected: boolean;
  manageHref?: string;
  installPath?: string;
};

type ChannelConnectionStatus = {
  connected: boolean;
  href: string;
};

type ChannelsCachePayload = {
  statuses: Record<string, ChannelConnectionStatus>;
  fetchedAt: number;
};

const CHANNELS_CACHE_TTL_MS = 30_000;
/** Leave a little breathing room above the bottom of the viewport. */
const VIEWPORT_BOTTOM_GAP_PX = 16;
/** Cap list height so the menu never fills the whole screen. */
const LIST_MAX_VIEWPORT_RATIO = 0.8;

const CONNECTION_ENDPOINTS: {
  id: string;
  path: string;
  installPath: string;
  managePrefix?: string;
}[] = [
  {
    id: "google",
    path: "/api/integrations/google-ads/connections",
    installPath: "/api/integrations/google-ads/install",
    managePrefix: "/settings/connections/google-ads",
  },
  {
    id: "meta",
    path: "/api/integrations/meta/connections",
    installPath: "/api/integrations/meta/install",
  },
  {
    id: "tiktok",
    path: "/api/integrations/tiktok/connections",
    installPath: "/api/integrations/tiktok/install",
  },
  {
    id: "amazon",
    path: "/api/integrations/amazon-ads/connections",
    installPath: "/api/integrations/amazon-ads/install",
  },
  {
    id: "x",
    path: "/api/integrations/x-ads/connections",
    installPath: "/api/integrations/x-ads/install",
  },
];

const INSTALL_PATH_BY_ID = Object.fromEntries(
  CONNECTION_ENDPOINTS.map((e) => [e.id, e.installPath]),
) as Record<string, string>;

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

function matchesQuery(channel: { name: string; description: string }, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    channel.name.toLowerCase().includes(q) ||
    channel.description.toLowerCase().includes(q)
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(needle, start);
  let key = 0;

  while (index !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    parts.push(
      <mark
        key={`m-${key++}`}
        className="rounded-[2px] bg-primary/25 text-inherit dark:bg-primary/35"
      >
        {text.slice(index, index + trimmed.length)}
      </mark>,
    );
    start = index + trimmed.length;
    index = lower.indexOf(needle, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return parts.length > 0 ? parts : text;
}

function ChannelLogo({
  name,
  logoSlug,
  websiteUrl,
}: {
  name: string;
  logoSlug: string;
  websiteUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  const mark = failed ? (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-medium text-muted-foreground"
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- simpleicons CDN brand marks
    <img
      src={channelLogoUrl(logoSlug)}
      alt=""
      width={20}
      height={20}
      className="size-5 shrink-0 dark:invert"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );

  return (
    <a
      href={websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${name} website`}
      title={`Open ${name} website`}
      className="shrink-0 rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={(event) => {
        // Keep the channels popover open for other actions.
        event.stopPropagation();
      }}
    >
      {mark}
    </a>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function rowStripeClass(index: number) {
  return index % 2 === 1 ? "bg-muted/40" : undefined;
}

function ChannelRow({
  channel,
  index,
  query,
  muted,
  action,
}: {
  channel: ChannelCatalogEntry;
  index: number;
  query: string;
  muted?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-md px-1.5 text-sm transition-colors hover:bg-muted/50",
        muted && "text-muted-foreground",
        rowStripeClass(index),
      )}
    >
      <ChannelLogo
        name={channel.name}
        logoSlug={channel.logoSlug}
        websiteUrl={channel.websiteUrl}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-tight">
          <HighlightMatch text={channel.name} query={query} />
        </span>
        <span
          className={cn(
            "block truncate text-[11px] leading-tight",
            muted ? "text-muted-foreground/80" : "text-muted-foreground",
          )}
        >
          <HighlightMatch text={channel.description} query={query} />
        </span>
      </span>
      {action}
    </div>
  );
}

export function ChannelsMenu() {
  const cached = readFreshChannelsCache();
  const [statuses, setStatuses] = useState<
    Record<string, ChannelConnectionStatus>
  >(cached?.statuses ?? {});
  const [loaded, setLoaded] = useState(Boolean(cached));
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState<number | undefined>();
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const updateListMaxHeight = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const headerHeight = headerRef.current?.offsetHeight ?? 40;
    const availableBelow =
      window.innerHeight - rect.top - headerHeight - VIEWPORT_BOTTOM_GAP_PX;
    const capped = Math.min(
      availableBelow,
      window.innerHeight * LIST_MAX_VIEWPORT_RATIO,
    );
    setListMaxHeight(Math.max(160, capped));
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateListMaxHeight();
    const frame = window.requestAnimationFrame(updateListMaxHeight);
    window.addEventListener("resize", updateListMaxHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateListMaxHeight);
    };
  }, [menuOpen, updateListMaxHeight, query]);

  const refresh = useCallback(async () => {
    try {
      const results = await Promise.all(
        CONNECTION_ENDPOINTS.map(async (endpoint) => {
          try {
            const res = await fetch(endpoint.path);
            if (!res.ok) {
              return [
                endpoint.id,
                { connected: false, href: "/settings/connections" },
              ] as const;
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
            const href =
              active[0] && endpoint.managePrefix
                ? `${endpoint.managePrefix}/${active[0].id}`
                : "/settings/connections";
            return [
              endpoint.id,
              { connected: active.length > 0, href },
            ] as const;
          } catch {
            return [
              endpoint.id,
              { connected: false, href: "/settings/connections" },
            ] as const;
          }
        }),
      );

      const next: Record<string, ChannelConnectionStatus> = {};
      for (const [id, status] of results) {
        next[id] = status;
      }
      setStatuses(next);
      writeChannelsCache({ statuses: next });
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
      const status = statuses[channel.id];
      return {
        ...channel,
        connected: status?.connected ?? false,
        manageHref: status?.href ?? "/settings/connections",
        installPath: INSTALL_PATH_BY_ID[channel.id],
      };
    });
  }, [statuses]);

  const connected = liveChannels.filter(
    (c) => c.connected && matchesQuery(c, query),
  );
  const notConnected = liveChannels.filter(
    (c) => !c.connected && matchesQuery(c, query),
  );
  const comingSoon = COMING_SOON_CHANNELS.filter((c) =>
    matchesQuery(c, query),
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
        <PopoverContent
          align="start"
          className="w-96 max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-2"
        >
          <div ref={contentRef} className="flex min-h-0 flex-col">
            <div
              ref={headerRef}
              className="flex items-center gap-0.5 px-0.5 pb-1.5"
            >
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search channels…"
                  className="h-8 border-0 bg-transparent pl-7 text-xs shadow-none ring-0 outline-none placeholder:text-neutral-400 focus-visible:border-0 focus-visible:ring-0 md:text-xs dark:bg-transparent dark:placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  aria-label="Search channels"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Suggest a channel"
                className="shrink-0"
                onClick={() => {
                  setMenuOpen(false);
                  setSuggestOpen(true);
                }}
              >
                <LifebuoyIcon className="size-3.5" />
              </Button>
              <Button
                render={<Link href="/settings/connections" />}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Channel settings"
                className="shrink-0"
              >
                <SettingsIcon className="size-3.5" />
              </Button>
            </div>

            <div
              className="min-h-0 overflow-y-auto overscroll-contain"
              style={
                listMaxHeight != null
                  ? { maxHeight: listMaxHeight }
                  : undefined
              }
            >
              {noMatches ? (
                <p className="px-1.5 py-3 text-sm text-muted-foreground">
                  No matching channels
                </p>
              ) : (
                <div className="space-y-4 pr-1">
                  {connected.length > 0 ? (
                    <div>
                      <GroupLabel>Connected</GroupLabel>
                      <ul>
                        {connected.map((channel, index) => (
                          <li key={channel.id}>
                            <ChannelRow
                              channel={channel}
                              index={index}
                              query={query}
                              action={
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
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {notConnected.length > 0 ? (
                    <div>
                      <GroupLabel>Not connected</GroupLabel>
                      <ul>
                        {notConnected.map((channel, index) => (
                          <li key={channel.id}>
                            <ChannelRow
                              channel={channel}
                              index={index}
                              query={query}
                              action={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  className="shrink-0"
                                  onClick={() => {
                                    if (channel.installPath) {
                                      window.location.href = channel.installPath;
                                    }
                                  }}
                                >
                                  Connect
                                </Button>
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {comingSoon.length > 0 ? (
                    <div>
                      <GroupLabel>Coming soon</GroupLabel>
                      <ul>
                        {comingSoon.map(
                          (channel: ChannelCatalogEntry, index) => (
                            <li key={channel.id}>
                              <ChannelRow
                                channel={channel}
                                index={index}
                                query={query}
                                muted
                              />
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <SuggestChannelDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </>
  );
}
