"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "@/components/icons";
import type { Campaign } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CampaignAssociationProps = {
  productId: string;
  campaignIds: string[];
  /** PATCH endpoint that accepts { action: "set_campaigns", campaignIds } */
  patchUrl: string;
  /** Optional preloaded campaigns for this product */
  campaigns?: Campaign[];
  className?: string;
  compact?: boolean;
};

export function CampaignAssociation({
  productId,
  campaignIds: initialIds,
  patchUrl,
  campaigns: preloaded,
  className,
  compact = false,
}: CampaignAssociationProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>(preloaded ?? []);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(!preloaded);

  useEffect(() => {
    setSelected(initialIds);
  }, [initialIds]);

  useEffect(() => {
    if (preloaded) {
      setCampaigns(preloaded);
      setLoadingList(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingList(true);
      try {
        const res = await fetch(`/api/products/${productId}/campaigns`);
        if (!res.ok) return;
        const body = (await res.json()) as { campaigns?: Campaign[] };
        if (!cancelled) setCampaigns(body.campaigns ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, preloaded]);

  const byId = useMemo(() => {
    const map = new Map<string, Campaign>();
    for (const c of campaigns) map.set(c.id, c);
    return map;
  }, [campaigns]);

  const labels = selected
    .map((id) => byId.get(id)?.name ?? id.slice(0, 8))
    .filter(Boolean);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save(nextIds: string[]) {
    setError(null);
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_campaigns",
        campaignIds: nextIds,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Failed to update campaigns");
      setSelected(initialIds);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No campaign</span>
        ) : (
          labels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="max-w-[10rem] truncate text-[10px] font-normal"
            >
              {label}
            </Badge>
          ))
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 gap-1 px-1.5 text-[11px] text-muted-foreground",
                  compact && "h-5",
                )}
                disabled={pending || loadingList}
              />
            }
          >
            Edit
            <ChevronsUpDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
              Link campaigns
            </p>
            {campaigns.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                No campaigns for this product yet.
              </p>
            ) : (
              <ul className="max-h-56 space-y-0.5 overflow-auto">
                {campaigns.map((campaign) => {
                  const checked = selected.includes(campaign.id);
                  return (
                    <li key={campaign.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                          checked && "bg-accent/60",
                        )}
                        onClick={() => toggle(campaign.id)}
                      >
                        <span
                          className={cn(
                            "flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-border",
                            checked && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {checked ? <Check className="size-2.5" /> : null}
                        </span>
                        <span className="min-w-0 truncate">{campaign.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2 flex justify-end gap-1.5 border-t border-border pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelected(initialIds);
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => {
                  void save(selected).then(() => setOpen(false));
                }}
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
