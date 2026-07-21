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

const STATIC_CHANNELS: ChannelRow[] = [
  { id: "meta", name: "Meta", connected: false },
  { id: "tiktok", name: "TikTok Ads", connected: false },
  { id: "pinterest", name: "Pinterest", connected: false },
];

export function ChannelsMenu() {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleHref, setGoogleHref] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

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
      setGoogleConnected(active.length > 0);
      setGoogleHref(
        active[0]
          ? `/settings/connections/google-ads/${active[0].id}`
          : "/settings/connections",
      );
    } catch {
      // Keep defaults when offline / unauthenticated.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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
    <Popover>
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
        <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-transform duration-200 group-aria-expanded/button:rotate-180" />
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
