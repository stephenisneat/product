"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PLUGIN_SNIPPET = `<script
  src="https://cdn.product.app/v1/plugin.js"
  data-site-key="pk_live_••••••••"
  async
></script>`;

const PLUGIN_CONNECTED = false;

export function ProductPluginMenu() {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(PLUGIN_SNIPPET);
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
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <span
          className={cn(
            "mr-0.5 size-1.5 shrink-0 rounded-full",
            PLUGIN_CONNECTED ? "bg-emerald-500" : "bg-red-500",
          )}
          aria-label={PLUGIN_CONNECTED ? "Plugin connected" : "Plugin not connected"}
        />
        Plugin
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="space-y-2 p-3">
          <div>
            <p className="text-sm font-medium">Product plugin</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Paste this on your site to track conversions.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
            {PLUGIN_SNIPPET}
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
      </PopoverContent>
    </Popover>
  );
}
