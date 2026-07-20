"use client";

import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { id: "google", name: "Google Ads", connected: true },
  { id: "meta", name: "Meta", connected: true },
  { id: "tiktok", name: "TikTok Ads", connected: false },
  { id: "pinterest", name: "Pinterest", connected: false },
] as const;

export function ChannelsMenu() {
  const connectedCount = CHANNELS.filter((c) => c.connected).length;

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="sm" className="text-xs" />}
      >
        <span
          className={cn(
            "mr-0.5 font-mono tabular-nums",
            connectedCount > 0 ? "text-emerald-500" : "text-red-500",
          )}
        >
          {connectedCount}
        </span>
        Channels
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-56 p-2">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
          Connected channels
        </p>
        <ul className="space-y-0.5">
          {CHANNELS.map((channel) => (
            <li
              key={channel.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm"
            >
              <span className="flex-1">{channel.name}</span>
              <Badge
                variant="outline"
                className={
                  channel.connected
                    ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                    : "text-[10px] text-muted-foreground"
                }
              >
                {channel.connected ? "Connected" : "Not connected"}
              </Badge>
            </li>
          ))}
        </ul>
        <Separator className="my-2" />
        <p className="px-1.5 py-1 text-sm text-muted-foreground">
          Manage channels…
        </p>
      </PopoverContent>
    </Popover>
  );
}
