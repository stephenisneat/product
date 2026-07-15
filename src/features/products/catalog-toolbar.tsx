"use client";

import { useState, type ReactNode } from "react";
import {
  ChartNoAxesCombinedIcon,
  CheckIcon,
  CodeXmlIcon,
  CopyIcon,
  LightbulbIcon,
  Link2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";

const PLUGIN_SNIPPET = `<script
  src="https://cdn.product.app/v1/plugin.js"
  data-site-key="pk_live_••••••••"
  async
></script>`;

const CHANNELS = [
  { id: "google", name: "Google Ads", connected: true },
  { id: "meta", name: "Meta", connected: true },
  { id: "tiktok", name: "TikTok Ads", connected: false },
  { id: "pinterest", name: "Pinterest", connected: false },
] as const;

const WALLET_BALANCE = 1240;
const REFILL_PRESETS = [50, 100, 250, 500] as const;

function ProductPluginMenu() {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(PLUGIN_SNIPPET);
      setCopied(true);
      toast.success("Plugin snippet copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn’t copy snippet");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <CodeXmlIcon data-icon="inline-start" />
        Plugin
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VisualizerButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <ChartNoAxesCombinedIcon data-icon="inline-start" />
      Visualizer
    </Button>
  );
}

function InsightsButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <LightbulbIcon data-icon="inline-start" />
      Insights
    </Button>
  );
}

function ChannelsMenu() {
  const connectedCount = CHANNELS.filter((c) => c.connected).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Link2Icon data-icon="inline-start" />
        Channels
        <Badge
          variant="outline"
          className="ml-0.5 h-4 min-w-4 justify-center px-1 text-[10px] font-normal"
        >
          {connectedCount}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Connected channels</DropdownMenuLabel>
          {CHANNELS.map((channel) => (
            <DropdownMenuItem key={channel.id} disabled className="opacity-100">
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
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Manage channels…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WalletMenu() {
  const [refillAmount, setRefillAmount] = useState("100");
  const [spendLimit, setSpendLimit] = useState("500");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <WalletIcon data-icon="inline-start" />
        {formatMoney(WALLET_BALANCE)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="space-y-3 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="font-heading text-lg font-semibold tracking-tight">
              {formatMoney(WALLET_BALANCE)}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="wallet-refill" className="text-xs font-medium">
              Refill wallet
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {REFILL_PRESETS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  size="xs"
                  variant={refillAmount === String(amount) ? "secondary" : "outline"}
                  onClick={() => setRefillAmount(String(amount))}
                >
                  {formatMoney(amount)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="wallet-refill"
                type="number"
                min={1}
                step={1}
                value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
                className="h-7"
                aria-label="Custom refill amount"
              />
              <Button type="button" size="sm" variant="secondary" disabled>
                Refill
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="wallet-spend-limit" className="text-xs font-medium">
              Daily spend limit
            </Label>
            <div className="flex gap-2">
              <Input
                id="wallet-spend-limit"
                type="number"
                min={0}
                step={1}
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
                className="h-7"
                aria-label="Daily spend limit"
              />
              <Button type="button" size="sm" variant="secondary" disabled>
                Save
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Caps ad spend across connected channels.
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CatalogToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <InsightsButton />
      <VisualizerButton />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <WalletMenu />
      <ChannelsMenu />
      <ProductPluginMenu />
      {children}
    </div>
  );
}
