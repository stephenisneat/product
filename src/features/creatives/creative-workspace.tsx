"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ellipsis,
  Loader2,
} from "@/components/icons";
import { useEffect, useState, useTransition } from "react";
import type { Creative, PerformancePoint, Product } from "@/domain";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PageCanvas } from "@/components/layout/page-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { CampaignAssociation } from "@/features/campaigns/campaign-association";
import { CreativeVideoEditor } from "@/features/creatives/creative-video-editor";
import { ScreenplayDocument } from "@/features/creatives/screenplay-document";
import { PerformanceChartLazy } from "@/features/reporting/performance-chart-lazy";
import { cn } from "@/lib/utils";

type CreativeTab =
  | "screenplay"
  | "storyboard"
  | "video"
  | "concept"
  | "assets"
  | "performance";

const VIDEO_STAGE_ORDER = ["screenplay", "storyboard", "video"] as const;
const DISPLAY_STAGE_ORDER = ["concept", "assets"] as const;

function stageOrderFor(creative: Creative) {
  return creative.kind === "display_ad" ? DISPLAY_STAGE_ORDER : VIDEO_STAGE_ORDER;
}

function stageLabel(stage: Creative["stage"]): string {
  switch (stage) {
    case "screenplay":
      return "Screenplay";
    case "storyboard":
      return "Storyboard";
    case "video":
      return "Video";
    case "concept":
      return "Concept";
    case "assets":
      return "Assets";
  }
}

function statusLabel(status: Creative["status"]): string {
  switch (status) {
    case "generating":
      return "Generating";
    case "awaiting_review":
      return "Awaiting review";
    case "revising":
      return "Revising";
    case "paused":
      return "Paused";
    case "rejected":
      return "Rejected";
    case "ready":
      return "Ready";
  }
}

function stageIndex(creative: Creative) {
  return (stageOrderFor(creative) as readonly string[]).indexOf(creative.stage);
}

/** User-uploaded ads skip screenplay/storyboard and land as ready video. */
function isUploadedCreative(creative: Creative): boolean {
  return (
    creative.kind === "video_ad" &&
    creative.stage === "video" &&
    Boolean(creative.video) &&
    !creative.screenplay &&
    !creative.storyboard
  );
}

function isTabEnabled(tab: CreativeTab, creative: Creative): boolean {
  if (tab === "performance") {
    return creative.status === "ready";
  }
  if (creative.kind === "display_ad") {
    if (tab !== "concept" && tab !== "assets") return false;
    const order = DISPLAY_STAGE_ORDER;
    const tabIdx = order.indexOf(tab);
    const currentIdx = stageIndex(creative);
    if (tabIdx < 0) return false;
    if (tabIdx <= currentIdx) return true;
    if (tab === "assets") return Boolean(creative.assets);
    return false;
  }
  if (isUploadedCreative(creative)) {
    return tab === "video";
  }
  if (tab !== "screenplay" && tab !== "storyboard" && tab !== "video") {
    return false;
  }
  const tabIdx = VIDEO_STAGE_ORDER.indexOf(tab);
  const currentIdx = stageIndex(creative);
  if (tabIdx < 0) return false;
  // Current and prior stages are reachable; later stages unlock once payload exists.
  if (tabIdx <= currentIdx) return true;
  if (tab === "storyboard") return Boolean(creative.storyboard);
  if (tab === "video") return Boolean(creative.video);
  return false;
}

function defaultTab(creative: Creative): CreativeTab {
  if (creative.kind === "display_ad") {
    if (isTabEnabled(creative.stage as CreativeTab, creative)) {
      return creative.stage as CreativeTab;
    }
    if (creative.concept) return "concept";
    return "concept";
  }
  if (isUploadedCreative(creative)) return "video";
  if (isTabEnabled(creative.stage as CreativeTab, creative)) {
    return creative.stage as CreativeTab;
  }
  if (creative.screenplay) return "screenplay";
  return "screenplay";
}

function tabItems(creative: Creative): readonly (readonly [CreativeTab, string])[] {
  if (creative.kind === "display_ad") {
    return [
      ["concept", "Concept"],
      ["assets", "Assets"],
      ["performance", "Performance"],
    ] as const;
  }
  if (isUploadedCreative(creative)) {
    return [
      ["video", "Video"],
      ["performance", "Performance"],
    ] as const;
  }
  return [
    ["screenplay", "Screenplay"],
    ["storyboard", "Storyboard"],
    ["video", "Video"],
    ["performance", "Performance"],
  ] as const;
}

function primaryBriefTab(creative: Creative): CreativeTab {
  return creative.kind === "display_ad" ? "concept" : "screenplay";
}

function StageEmptyState({
  label,
  generating,
  paused,
}: {
  label: string;
  generating?: boolean;
  paused?: boolean;
}) {
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Generating {label.toLowerCase()}…
      </div>
    );
  }
  if (paused) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
        Generation paused. Resume to continue {label.toLowerCase()}.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
      No {label.toLowerCase()} yet.
    </div>
  );
}

function StoryboardView({ creative }: { creative: Creative }) {
  const storyboard = creative.storyboard;
  if (!storyboard) {
    return (
      <StageEmptyState
        label="Storyboard"
        generating={
          creative.stage === "storyboard" && creative.status === "generating"
        }
        paused={
          creative.stage === "storyboard" && creative.status === "paused"
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <p className="text-sm text-muted-foreground">{storyboard.styleBrief}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {storyboard.frames.map((frame) => (
          <figure
            key={`${frame.sceneId}-${frame.shotDescription.slice(0, 12)}`}
            className="overflow-hidden rounded-lg border border-border bg-card/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.imageUrl}
              alt={frame.shotDescription}
              className="aspect-[9/16] w-full object-cover"
            />
            <figcaption className="space-y-1 p-2.5">
              <p className="line-clamp-3 text-xs leading-snug text-foreground">
                {frame.shotDescription}
              </p>
              <p className="text-[11px] text-muted-foreground">{frame.camera}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function VideoView({ creative }: { creative: Creative }) {
  if (!creative.video) {
    return (
      <StageEmptyState
        label="Video"
        generating={
          creative.stage === "video" && creative.status === "generating"
        }
        paused={creative.stage === "video" && creative.status === "paused"}
      />
    );
  }

  return <CreativeVideoEditor creative={creative} />;
}

function ConceptView({ creative }: { creative: Creative }) {
  const concept = creative.concept;
  if (!concept) {
    return (
      <StageEmptyState
        label="Concept"
        generating={
          creative.stage === "concept" && creative.status === "generating"
        }
        paused={creative.stage === "concept" && creative.status === "paused"}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Business name
        </p>
        <p className="text-sm text-foreground">{concept.businessName}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Long headline
        </p>
        <p className="text-lg font-medium leading-snug text-foreground">
          {concept.longHeadline}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Headlines
        </p>
        <ul className="space-y-1.5">
          {concept.headlines.map((headline) => (
            <li
              key={headline}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              {headline}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Descriptions
        </p>
        <ul className="space-y-1.5">
          {concept.descriptions.map((description) => (
            <li
              key={description}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              {description}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Style brief
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {concept.styleBrief}
        </p>
      </div>
    </div>
  );
}

function AssetsView({ creative }: { creative: Creative }) {
  const assets = creative.assets;
  if (!assets) {
    return (
      <StageEmptyState
        label="Assets"
        generating={
          creative.stage === "assets" && creative.status === "generating"
        }
        paused={creative.stage === "assets" && creative.status === "paused"}
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:grid-cols-2">
      <figure className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Marketing · 1.91:1
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assets.marketingImageUrl}
          alt="Marketing display image"
          className="aspect-[1.91/1] w-full rounded-lg border border-border object-cover"
        />
      </figure>
      <figure className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Square · 1:1
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assets.squareImageUrl}
          alt="Square display image"
          className="aspect-square w-full rounded-lg border border-border object-cover"
        />
      </figure>
    </div>
  );
}

function PerformanceView({
  creative,
  performance,
  onCreativeChange,
}: {
  creative: Creative;
  performance: PerformancePoint[];
  onCreativeChange?: (creative: Creative) => void;
}) {
  const [googleAssetId, setGoogleAssetId] = useState(
    creative.externalAdRefs.googleAssetId ?? "",
  );
  const [savingRefs, setSavingRefs] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);

  useEffect(() => {
    setGoogleAssetId(creative.externalAdRefs.googleAssetId ?? "");
  }, [creative.externalAdRefs.googleAssetId]);

  async function saveExternalRefs() {
    setSavingRefs(true);
    setRefsError(null);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_external_ad_refs",
          externalAdRefs: {
            googleAssetId: googleAssetId.trim() || undefined,
            metaAdId: creative.externalAdRefs.metaAdId,
            tiktokAdId: creative.externalAdRefs.tiktokAdId,
          },
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        creative?: Creative;
      } | null;
      if (!res.ok || !body?.creative) {
        throw new Error(body?.error ?? "Failed to save ad IDs.");
      }
      onCreativeChange?.(body.creative);
    } catch (err) {
      setRefsError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingRefs(false);
    }
  }

  if (creative.status !== "ready") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 px-4 py-24 text-center text-sm text-muted-foreground">
        <p>Performance unlocks when this creative is ready.</p>
        <p className="text-xs">
          Download the MP4 and link campaigns from the workspace once generation
          finishes.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">External ad IDs</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste platform ad/asset IDs after you upload the MP4 yourself. Sync
            pulls creative-level metrics from connected Google Ads accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="google-asset-id">Google ad / asset ID</Label>
            <Input
              id="google-asset-id"
              value={googleAssetId}
              onChange={(e) => setGoogleAssetId(e.target.value)}
              placeholder="1234567890"
              disabled={savingRefs}
            />
          </div>
          <Button
            size="sm"
            disabled={savingRefs}
            onClick={() => void saveExternalRefs()}
          >
            {savingRefs ? "Saving…" : "Save"}
          </Button>
        </div>
        {refsError ? (
          <p className="text-xs text-destructive">{refsError}</p>
        ) : null}
      </div>

      {performance.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
          <p>No creative-level performance data yet.</p>
          <p className="max-w-lg text-xs leading-relaxed">
            Download the MP4, link this creative to a campaign, and connect an ad
            account in Settings. After ads run, save a Google ad ID above and sync
            via the API — we do not upload videos to Meta, Google, or TikTok from
            here.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-xs text-muted-foreground">
            Creative-level performance (from linked external ad IDs).
          </p>
          <PerformanceChartLazy data={performance} />
        </div>
      )}
    </div>
  );
}

function ReviewBar({
  creative,
  pending,
  revising,
  feedback,
  error,
  onFeedbackChange,
  onReviseToggle,
  onAction,
}: {
  creative: Creative;
  pending: boolean;
  revising: boolean;
  feedback: string;
  error: string | null;
  onFeedbackChange: (value: string) => void;
  onReviseToggle: (open: boolean) => void;
  onAction: (
    action: "accept" | "reject" | "revise" | "resubmit" | "reopen",
  ) => void;
}) {
  if (creative.status === "rejected") {
    return (
      <div className="shrink-0 border-t border-border bg-black px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
          {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onAction("reopen")}
          >
            Reopen
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Rejected — reopen to resume or resubmit
          </span>
        </div>
      </div>
    );
  }

  if (creative.status === "revising") {
    return (
      <div className="shrink-0 border-t border-border bg-black px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Textarea
            className="text-xs"
            rows={3}
            placeholder="What should change?"
            value={feedback}
            onChange={(e) => onFeedbackChange(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onAction("resubmit")}
            >
              Resubmit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onAction("reject")}
            >
              Reject
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              Revising {stageLabel(creative.stage).toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (creative.status !== "awaiting_review") return null;

  return (
    <div className="shrink-0 border-t border-border bg-black px-4 py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        {revising ? (
          <Textarea
            className="text-xs"
            rows={3}
            placeholder="What should change?"
            value={feedback}
            onChange={(e) => onFeedbackChange(e.target.value)}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onAction("accept")}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onAction("reject")}
          >
            Reject
          </Button>
          {revising ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onAction("resubmit")}
              >
                Resubmit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onAction("revise")}
              >
                Send to chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onReviseToggle(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onReviseToggle(true)}
            >
              Revise
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Reviewing {stageLabel(creative.stage).toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CreativeWorkspace({
  creative: initial,
  product,
  performance = [],
  initialTab,
}: {
  creative: Creative;
  product: Product | null;
  performance?: PerformancePoint[];
  initialTab?: CreativeTab;
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [creative, setCreative] = useState(initial);
  const [tab, setTab] = useState<CreativeTab>(() => {
    if (initialTab && isTabEnabled(initialTab, initial)) return initialTab;
    return defaultTab(initial);
  });
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCreative(initial);
    setTab((current) =>
      isTabEnabled(current, initial) ? current : defaultTab(initial),
    );
  }, [initial]);

  useEffect(() => {
    if (creative.status !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/creatives/${creative.id}`);
        if (!res.ok) return;
        const body = (await res.json()) as { creative?: Creative };
        if (!cancelled && body.creative) {
          setCreative(body.creative);
          setTab((current) =>
            isTabEnabled(current, body.creative!)
              ? current
              : defaultTab(body.creative!),
          );
          if (body.creative.status !== "generating") {
            startTransition(() => router.refresh());
          }
        }
      } catch {
        // ignore poll errors
      }
    };
    const id = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [creative.id, creative.status, router]);

  async function mutate(
    action:
      | "accept"
      | "reject"
      | "revise"
      | "resubmit"
      | "reopen"
      | "pause"
      | "resume",
  ) {
    setError(null);
    const res = await fetch(`/api/creatives/${creative.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        feedback:
          action === "revise" || action === "resubmit"
            ? feedback.trim() || undefined
            : undefined,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Request failed");
      return;
    }

    const body = (await res.json()) as {
      creative: Creative;
      revisePrompt?: string;
    };
    setCreative(body.creative);
    setTab((current) =>
      isTabEnabled(current, body.creative)
        ? current
        : defaultTab(body.creative),
    );

    if (action === "revise" && body.revisePrompt) {
      setComposePrefill(body.revisePrompt);
      setRevising(false);
      setFeedback("");
    }

    if (action === "resubmit") {
      setRevising(false);
      setFeedback("");
    }

    startTransition(() => router.refresh());
  }

  async function removeCreative() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        const message = body?.error ?? "Delete failed";
        setError(message);
        throw new Error(message);
      }
      startTransition(() => {
        router.push("/creatives");
        router.refresh();
      });
    } finally {
      setDeleting(false);
    }
  }

  const canControlJob =
    creative.status === "generating" || creative.status === "paused";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (isTabEnabled(value as CreativeTab, creative)) {
          setTab(value as CreativeTab);
        }
      }}
      className="h-full gap-0"
    >
      <PageCanvas
        headerClassName="border-border bg-black backdrop-blur-none supports-backdrop-filter:bg-black"
        contentClassName="flex flex-col overflow-hidden bg-black"
        header={
          <div className="relative flex w-full items-center">
            <div className="z-10 flex min-w-0 max-w-[28%] items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1.5 text-muted-foreground"
                render={<Link href="/creatives" />}
              >
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
              <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
                <span className="truncate text-sm font-medium">
                  {creative.title}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {creative.kind === "display_ad" ? "Display" : "Video"}
                </Badge>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {statusLabel(creative.status)}
                </Badge>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 sm:px-28">
              <TabsList
                variant="line"
                className="pointer-events-auto h-auto max-w-full gap-0 overflow-x-auto bg-transparent p-0"
              >
                {tabItems(creative).map(([value, label]) => {
                  const enabled = isTabEnabled(value, creative);
                  return (
                    <TabsTrigger
                      key={value}
                      value={value}
                      disabled={!enabled}
                      className={cn(
                        "rounded-none px-3 py-1.5 text-xs sm:text-sm",
                        !enabled && "opacity-40",
                      )}
                    >
                      {label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="z-10 ml-auto flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Creative actions"
                    />
                  }
                >
                  <Ellipsis className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {product ? (
                    <DropdownMenuItem
                      onClick={() => router.push(`/products/${product.id}`)}
                    >
                      View product
                    </DropdownMenuItem>
                  ) : null}
                  {canControlJob ? (
                    creative.status === "generating" ? (
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => void mutate("pause")}
                      >
                        Pause generation
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => void mutate("resume")}
                      >
                        Resume generation
                      </DropdownMenuItem>
                    )
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending || deleting}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete creative
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col bg-black">
          {(product || creative.brief) && tab !== primaryBriefTab(creative) ? (
            <div className="shrink-0 border-b border-border px-4 py-2">
              <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2">
                {product ? (
                  <Badge variant="outline" className="text-[10px]">
                    <Link
                      href={`/products/${product.id}`}
                      className="hover:underline"
                    >
                      {product.title}
                    </Link>
                  </Badge>
                ) : null}
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {creative.brief}
                </p>
                <CampaignAssociation
                  className="ml-auto"
                  productId={creative.productId}
                  campaignIds={creative.campaignIds}
                  patchUrl={`/api/creatives/${creative.id}`}
                  compact
                />
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-black">
            <TabsContent value="screenplay" className="mt-0 h-full">
              {creative.screenplay ? (
                <div className="min-h-full bg-black px-3 py-8 sm:px-6">
                  <ScreenplayDocument screenplay={creative.screenplay} />
                </div>
              ) : (
                <StageEmptyState
                  label="Screenplay"
                  generating={
                    creative.stage === "screenplay" &&
                    creative.status === "generating"
                  }
                  paused={
                    creative.stage === "screenplay" &&
                    creative.status === "paused"
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="storyboard" className="mt-0">
              <StoryboardView creative={creative} />
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <VideoView creative={creative} />
            </TabsContent>

            <TabsContent value="concept" className="mt-0">
              <ConceptView creative={creative} />
            </TabsContent>

            <TabsContent value="assets" className="mt-0">
              <AssetsView creative={creative} />
            </TabsContent>

            <TabsContent value="performance" className="mt-0">
              <PerformanceView
                creative={creative}
                performance={performance}
                onCreativeChange={setCreative}
              />
            </TabsContent>
          </div>

          <ReviewBar
            creative={creative}
            pending={pending}
            revising={revising}
            feedback={feedback}
            error={error}
            onFeedbackChange={setFeedback}
            onReviseToggle={(open) => {
              setRevising(open);
              if (!open) setFeedback("");
            }}
            onAction={(action) => void mutate(action)}
          />
        </div>
      </PageCanvas>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete creative?"
        description={`“${creative.title}” will be permanently deleted, and any in-progress generation on Trigger.dev will be canceled. This cannot be undone.`}
        pending={deleting}
        onConfirm={removeCreative}
      />
    </Tabs>
  );
}
