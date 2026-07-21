"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, CopyIcon, SettingsIcon } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PluginInstallStatus } from "@/lib/plugin/types";

const FALLBACK_SNIPPET = `<script
  src="http://localhost:3001/v1/plugin.js"
  data-workspace="…"
  async
></script>`;

export function ProductPluginMenu() {
  const [copied, setCopied] = useState(false);
  const [snippet, setSnippet] = useState(FALLBACK_SNIPPET);
  const [status, setStatus] = useState<PluginInstallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [containerRes, statusRes] = await Promise.all([
        fetch("/api/plugin/container"),
        fetch("/api/plugin/container/install-status"),
      ]);

      if (containerRes.ok) {
        const data = await containerRes.json();
        if (typeof data.installSnippet === "string" && data.installSnippet) {
          setSnippet(data.installSnippet);
        }
      }

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
    } catch {
      // Keep fallback snippet; status stays null.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connected = Boolean(status?.has_ever_received);

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

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="text-xs text-neutral-400" />
        }
      >
        <span
          className={cn(
            "mr-0.5 size-1.5 shrink-0 rounded-full",
            loading
              ? "bg-muted-foreground/40"
              : connected
                ? "bg-emerald-500"
                : "bg-red-500",
          )}
          aria-label={
            connected ? "Plugin connected" : "Plugin not connected"
          }
        />
        Plugin
        <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-[color,transform] duration-200 group-hover/button:text-neutral-300 group-aria-expanded/button:rotate-180 group-aria-expanded/button:text-neutral-300" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="space-y-2 p-3">
          <div>
            <p className="text-sm font-medium">Product plugin</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {connected
                ? `Receiving events · ${status?.last_hour_count ?? 0} in the last hour`
                : "Paste this on your site to start tracking."}
            </p>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
            {snippet}
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
        </div>
        <Separator />
        <div className="p-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            render={<Link href="/settings/plugin" />}
          >
            <SettingsIcon data-icon="inline-start" />
            Manage plugin
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
