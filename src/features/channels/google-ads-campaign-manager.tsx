"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCustomerId } from "@/lib/channels/providers/google-ads/format";

type GoogleAdsCampaign = {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  channelType: string;
  biddingStrategyType?: string;
  campaignBudget?: string;
  startDate?: string;
  endDate?: string;
};

type AdConnection = {
  id: string;
  accountName: string;
  externalAccountId: string | null;
  currencyCode?: string | null;
  isManager: boolean;
};

export function GoogleAdsCampaignManager({
  connectionId,
  canManage,
}: {
  connectionId: string;
  canManage: boolean;
}) {
  const [connection, setConnection] = useState<AdConnection | null>(null);
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<"SEARCH" | "DISPLAY" | "VIDEO">(
    "SEARCH",
  );
  const [dailyBudget, setDailyBudget] = useState("50");
  const [biddingStrategy, setBiddingStrategy] = useState("MAXIMIZE_CLICKS");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [connRes, campRes] = await Promise.all([
        fetch("/api/integrations/google-ads/connections"),
        fetch(
          `/api/integrations/google-ads/${connectionId}/campaigns?channelType=SEARCH&channelType=DISPLAY&channelType=VIDEO`,
        ),
      ]);
      const connBody = (await connRes.json()) as {
        error?: string;
        connections?: AdConnection[];
      };
      const campBody = (await campRes.json()) as {
        error?: string;
        campaigns?: GoogleAdsCampaign[];
      };
      if (!connRes.ok) throw new Error(connBody.error || "Failed to load connection");
      if (!campRes.ok) throw new Error(campBody.error || "Failed to load campaigns");
      const match = (connBody.connections ?? []).find((c) => c.id === connectionId);
      if (!match) throw new Error("Connection not found");
      setConnection(match);
      setCampaigns(campBody.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const setStatus = async (
    campaign: GoogleAdsCampaign,
    status: "ENABLED" | "PAUSED" | "REMOVED",
  ) => {
    try {
      const res = await fetch(
        `/api/integrations/google-ads/${connectionId}/operations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            resource: "campaign",
            resourceName: campaign.resourceName,
            status,
          }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update status");
      toast.success(
        status === "REMOVED"
          ? "Campaign removed"
          : status === "ENABLED"
            ? "Campaign enabled"
            : "Campaign paused",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const createCampaign = async () => {
    const budget = Number(dailyBudget);
    if (!name.trim() || !Number.isFinite(budget) || budget <= 0) {
      toast.error("Enter a name and positive daily budget");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(
        `/api/integrations/google-ads/${connectionId}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            channelType,
            dailyBudget: budget,
            biddingStrategy,
            status: "PAUSED",
          }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to create campaign");
      toast.success("Campaign created (paused)");
      setShowCreate(false);
      setName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const channelLabel = (type: string) => {
    if (type === "SEARCH") return "Search";
    if (type === "DISPLAY") return "Display";
    if (type === "VIDEO") return "YouTube";
    return type;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={<Link href="/settings/connections" />}
          >
            ← Connections
          </Button>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {connection?.accountName || "Google Ads"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {connection?.externalAccountId
              ? formatCustomerId(connection.externalAccountId)
              : null}
            {connection?.currencyCode ? ` · ${connection.currencyCode}` : null}
            {" · Search, Display & YouTube"}
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "New campaign"}
          </Button>
        ) : null}
      </div>

      {showCreate ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Create campaign</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring Search — Brand"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select
                value={channelType}
                onValueChange={(v) =>
                  setChannelType(v as "SEARCH" | "DISPLAY" | "VIDEO")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEARCH">Search</SelectItem>
                  <SelectItem value="DISPLAY">Display</SelectItem>
                  <SelectItem value="VIDEO">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-budget">Daily budget</Label>
              <Input
                id="daily-budget"
                type="number"
                min="1"
                step="0.01"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Bidding</Label>
              <Select
                value={biddingStrategy}
                onValueChange={(v) => setBiddingStrategy(v ?? "MAXIMIZE_CLICKS")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAXIMIZE_CLICKS">Maximize clicks</SelectItem>
                  <SelectItem value="MANUAL_CPC">Manual CPC</SelectItem>
                  <SelectItem value="MAXIMIZE_CONVERSIONS">
                    Maximize conversions
                  </SelectItem>
                  <SelectItem value="TARGET_CPA">Target CPA</SelectItem>
                  <SelectItem value="TARGET_ROAS">Target ROAS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={creating}
            onClick={() => void createCampaign()}
          >
            {creating ? "Creating…" : "Create paused campaign"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Search, Display, or YouTube campaigns yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center gap-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{campaign.name}</p>
                <p className="text-xs text-muted-foreground">
                  {channelLabel(campaign.channelType)}
                  {campaign.biddingStrategyType
                    ? ` · ${campaign.biddingStrategyType}`
                    : ""}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {campaign.status}
              </Badge>
              {canManage && campaign.status !== "REMOVED" ? (
                <div className="flex gap-1">
                  {campaign.status === "ENABLED" ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => void setStatus(campaign, "PAUSED")}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => void setStatus(campaign, "ENABLED")}
                    >
                      Enable
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Remove this campaign?")) {
                        void setStatus(campaign, "REMOVED");
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Advanced GAQL search and raw mutate are available at{" "}
        <code className="font-mono text-[11px]">
          /api/integrations/google-ads/{connectionId}/search
        </code>{" "}
        and{" "}
        <code className="font-mono text-[11px]">
          /api/integrations/google-ads/{connectionId}/mutate
        </code>
        .
      </p>
    </div>
  );
}
