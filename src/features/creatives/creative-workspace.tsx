"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft02Icon,
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
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { CreativeFloatingPrompt } from "@/features/creatives/creative-floating-prompt";
import { CreativeVideoEditor } from "@/features/creatives/creative-video-editor";
import { ScreenplayView } from "@/features/creatives/screenplay-view";
import { WorldView } from "@/features/creatives/world-view";
import { PerformanceChartLazy } from "@/features/reporting/performance-chart-lazy";

type CreativeTab =
  | "screenplay"
  | "world"
  | "storyboard"
  | "video"
  | "concept"
  | "assets"
  | "copy"
  | "keywords"
  | "script"
  | "audio"
  | "distribution";

function stageLabel(stage: Creative["stage"]): string {
  switch (stage) {
    case "screenplay":
      return "Screenplay";
    case "world":
      return "World";
    case "storyboard":
      return "Storyboard";
    case "video":
      return "Video";
    case "concept":
      return "Concept";
    case "assets":
      return "Assets";
    case "copy":
      return "Copy";
    case "keywords":
      return "Keywords";
    case "script":
      return "Script";
    case "audio":
      return "Audio";
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

/** User-uploaded ads skip screenplay/world/storyboard and land as ready video. */
function isUploadedCreative(creative: Creative): boolean {
  return (
    creative.kind === "video_ad" &&
    creative.stage === "video" &&
    Boolean(creative.video) &&
    !creative.screenplay &&
    !creative.world &&
    !creative.storyboard
  );
}

function isKnownTab(tab: string, creative: Creative): tab is CreativeTab {
  return tabItems(creative).some((item) => item.value === tab);
}

function defaultTab(creative: Creative): CreativeTab {
  if (creative.kind === "display_ad") {
    if (creative.stage === "concept" || creative.stage === "assets") {
      return creative.stage;
    }
    return "concept";
  }
  if (creative.kind === "search_ad") {
    if (creative.stage === "copy" || creative.stage === "keywords") {
      return creative.stage;
    }
    return "copy";
  }
  if (creative.kind === "audio_ad") {
    if (creative.stage === "script" || creative.stage === "audio") {
      return creative.stage;
    }
    return "script";
  }
  if (isUploadedCreative(creative)) return "video";
  if (
    creative.stage === "screenplay" ||
    creative.stage === "world" ||
    creative.stage === "storyboard" ||
    creative.stage === "video"
  ) {
    return creative.stage;
  }
  return "screenplay";
}

function tabItems(
  creative: Creative,
): readonly { value: CreativeTab; label: string }[] {
  if (creative.kind === "display_ad") {
    return [
      { value: "concept", label: "Concept" },
      { value: "assets", label: "Assets" },
      { value: "distribution", label: "Distribution" },
    ];
  }
  if (creative.kind === "search_ad") {
    return [
      { value: "copy", label: "Copy" },
      { value: "keywords", label: "Keywords" },
      { value: "distribution", label: "Distribution" },
    ];
  }
  if (creative.kind === "audio_ad") {
    return [
      { value: "script", label: "Script" },
      { value: "audio", label: "Audio" },
      { value: "distribution", label: "Distribution" },
    ];
  }
  return [
    { value: "screenplay", label: "Screenplay" },
    { value: "world", label: "World" },
    { value: "storyboard", label: "Storyboard" },
    { value: "video", label: "Video" },
    { value: "distribution", label: "Distribution" },
  ];
}

function StageEmptyState({
  label,
  generating,
  paused,
  action,
}: {
  label: string;
  generating?: boolean;
  paused?: boolean;
  action?: { label: string; pending?: boolean; onClick: () => void };
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
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-sm text-muted-foreground">
      <p>No {label.toLowerCase()} yet.</p>
      {action ? (
        <>
          <p className="max-w-sm text-xs leading-relaxed">
            Screenplay, world, and storyboard are ready. Generate the video when
            you are.
          </p>
          <Button
            size="sm"
            disabled={action.pending}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </>
      ) : (
        <p className="max-w-sm text-xs leading-relaxed">
          This stage will appear here when {label.toLowerCase()} is generated.
        </p>
      )}
    </div>
  );
}

function canGenerateVideo(creative: Creative): boolean {
  return (
    creative.kind === "video_ad" &&
    creative.stage === "storyboard" &&
    creative.status === "awaiting_review" &&
    Boolean(creative.storyboard) &&
    !creative.video
  );
}

/** True while the auto screenplay → world → storyboard chain is running. */
function isVideoPrepGenerating(creative: Creative): boolean {
  return (
    creative.kind === "video_ad" &&
    creative.status === "generating" &&
    (creative.stage === "screenplay" ||
      creative.stage === "world" ||
      creative.stage === "storyboard")
  );
}

function StoryboardView({ creative }: { creative: Creative }) {
  const storyboard = creative.storyboard;
  if (!storyboard) {
    return (
      <StageEmptyState
        label="Storyboard"
        generating={
          (creative.stage === "storyboard" &&
            creative.status === "generating") ||
          isVideoPrepGenerating(creative)
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
              className="aspect-video w-full object-cover"
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

function VideoView({
  creative,
  pending,
  onGenerate,
}: {
  creative: Creative;
  pending?: boolean;
  onGenerate?: () => void;
}) {
  if (!creative.video) {
    const readyToGenerate = canGenerateVideo(creative);
    return (
      <StageEmptyState
        label="Video"
        generating={
          creative.stage === "video" && creative.status === "generating"
        }
        paused={creative.stage === "video" && creative.status === "paused"}
        action={
          readyToGenerate && onGenerate
            ? {
                label: "Generate video",
                pending,
                onClick: onGenerate,
              }
            : undefined
        }
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

function CopyView({ creative }: { creative: Creative }) {
  const copy = creative.copy;
  if (!copy) {
    return (
      <StageEmptyState
        label="Copy"
        generating={
          creative.stage === "copy" && creative.status === "generating"
        }
        paused={creative.stage === "copy" && creative.status === "paused"}
      />
    );
  }

  const displayUrl =
    copy.path1 || copy.path2
      ? `example.com/${[copy.path1, copy.path2].filter(Boolean).join("/")}`
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Angle
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {copy.angle}
        </p>
      </div>

      {displayUrl ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Display URL paths
          </p>
          <p className="text-sm text-foreground">{displayUrl}</p>
        </div>
      ) : null}

      {copy.finalUrl ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Final URL
          </p>
          <p className="break-all text-sm text-foreground">{copy.finalUrl}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Headlines · {copy.headlines.length}
        </p>
        <ul className="space-y-1.5">
          {copy.headlines.map((headline) => (
            <li
              key={headline}
              className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>{headline}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {headline.length}/30
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Descriptions · {copy.descriptions.length}
        </p>
        <ul className="space-y-1.5">
          {copy.descriptions.map((description) => (
            <li
              key={description}
              className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              <span>{description}</span>
              <span className="shrink-0 text-[10px]">
                {description.length}/90
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function KeywordsView({ creative }: { creative: Creative }) {
  const keywords = creative.keywords;
  if (!keywords) {
    return (
      <StageEmptyState
        label="Keywords"
        generating={
          creative.stage === "keywords" && creative.status === "generating"
        }
        paused={creative.stage === "keywords" && creative.status === "paused"}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Themes · {keywords.themes.length}
        </p>
        <ul className="space-y-1.5">
          {keywords.themes.map((theme) => (
            <li
              key={`${theme.matchType}:${theme.phrase}`}
              className="rounded-md border border-border px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {theme.phrase}
                </span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {theme.matchType}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{theme.intent}</p>
            </li>
          ))}
        </ul>
      </div>

      {keywords.negatives.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Negatives · {keywords.negatives.length}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {keywords.negatives.map((negative) => (
              <li
                key={negative}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              >
                −{negative}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ScriptView({ creative }: { creative: Creative }) {
  const script = creative.script;
  if (!script) {
    return (
      <StageEmptyState
        label="Script"
        generating={
          creative.stage === "script" && creative.status === "generating"
        }
        paused={creative.stage === "script" && creative.status === "paused"}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>~{script.targetDurationSec}s</span>
        {script.musicBed ? <span>Bed: {script.musicBed}</span> : null}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Voice direction
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {script.voiceDirection}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Hook
        </p>
        <p className="rounded-md border border-border px-3 py-2 text-sm">
          {script.hook}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Body
        </p>
        <p className="rounded-md border border-border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
          {script.body}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          CTA
        </p>
        <p className="rounded-md border border-border px-3 py-2 text-sm">
          {script.cta}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Full script
        </p>
        <pre className="rounded-md border border-border bg-muted/30 px-3 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {script.fullScript}
        </pre>
      </div>
    </div>
  );
}

function AudioSpotView({ creative }: { creative: Creative }) {
  const audio = creative.audio;
  if (!audio) {
    return (
      <StageEmptyState
        label="Audio"
        generating={
          creative.stage === "audio" && creative.status === "generating"
        }
        paused={creative.stage === "audio" && creative.status === "paused"}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Spot · ~{audio.durationSec}s
        </p>
        <audio controls preload="metadata" className="w-full" src={audio.url}>
          <track kind="captions" />
        </audio>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Transcript
        </p>
        <pre className="rounded-md border border-border px-3 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {audio.transcript}
        </pre>
      </div>
    </div>
  );
}

function DistributionView({
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
  const [metaAdId, setMetaAdId] = useState(
    creative.externalAdRefs.metaAdId ?? "",
  );
  const [savingRefs, setSavingRefs] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"google" | "meta">("google");
  const [connectionId, setConnectionId] = useState("");
  const [connections, setConnections] = useState<
    { id: string; provider: string; accountName: string; status: string }[]
  >([]);
  const [finalUrl, setFinalUrl] = useState(
    creative.copy?.finalUrl ?? "",
  );
  const [metaPageId, setMetaPageId] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [dailyBudget, setDailyBudget] = useState("20");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishOk, setPublishOk] = useState<string | null>(null);

  useEffect(() => {
    setGoogleAssetId(creative.externalAdRefs.googleAssetId ?? "");
    setMetaAdId(creative.externalAdRefs.metaAdId ?? "");
  }, [
    creative.externalAdRefs.googleAssetId,
    creative.externalAdRefs.metaAdId,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/integrations/connections");
        const body = (await res.json().catch(() => null)) as {
          adConnections?: {
            id: string;
            provider: string;
            accountName: string;
            status: string;
          }[];
        } | null;
        if (cancelled || !body?.adConnections) return;
        setConnections(
          body.adConnections.filter(
            (c) =>
              c.status === "active" &&
              (c.provider === "google" || c.provider === "meta"),
          ),
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const providerConnections = connections.filter((c) => c.provider === provider);

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
            metaAdId: metaAdId.trim() || undefined,
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

  async function publishCreative() {
    setPublishing(true);
    setPublishError(null);
    setPublishOk(null);
    try {
      if (!connectionId) throw new Error("Select a connected ad account.");
      if (!finalUrl.trim()) throw new Error("Final URL is required.");
      const res = await fetch(`/api/creatives/${creative.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          connectionId,
          finalUrl: finalUrl.trim(),
          dailyBudget: Number(dailyBudget) || 20,
          chargeSpend: false,
          metaPageId: provider === "meta" ? metaPageId.trim() || undefined : undefined,
          youtubeVideoId:
            provider === "google" && creative.kind === "video_ad"
              ? youtubeVideoId.trim() || undefined
              : undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        externalAdId?: string;
        externalCampaignId?: string;
        creative?: Creative;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Publish failed.");
      }
      if (body?.creative) onCreativeChange?.(body.creative);
      setPublishOk(
        `Published as paused campaign ${body?.externalCampaignId ?? ""} / ad ${body?.externalAdId ?? ""}.`,
      );
      if (body?.creative?.externalAdRefs.googleAssetId) {
        setGoogleAssetId(body.creative.externalAdRefs.googleAssetId);
      }
      if (body?.creative?.externalAdRefs.metaAdId) {
        setMetaAdId(body.creative.externalAdRefs.metaAdId);
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  if (creative.status !== "ready") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 px-4 py-24 text-center text-sm text-muted-foreground">
        <p>No distribution yet.</p>
        <p className="text-xs leading-relaxed">
          Distribution opens once this creative is ready — accept the final stage
          to unlock publish, ad IDs, downloads, and performance.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">Publish to ad channel</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a paused campaign + ad on a connected Google or Meta account
            from this creative. Activate spend from the campaign when you are
            ready to launch.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="publish-provider">Channel</Label>
            <select
              id="publish-provider"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={provider}
              onChange={(e) => {
                const next = e.target.value as "google" | "meta";
                setProvider(next);
                setConnectionId("");
              }}
              disabled={publishing}
            >
              <option value="google">Google Ads</option>
              <option value="meta">Meta Ads</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publish-connection">Account</Label>
            <select
              id="publish-connection"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              disabled={publishing || providerConnections.length === 0}
            >
              <option value="">
                {providerConnections.length === 0
                  ? "No connected account"
                  : "Select account"}
              </option>
              {providerConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="publish-final-url">Final URL</Label>
            <Input
              id="publish-final-url"
              value={finalUrl}
              onChange={(e) => setFinalUrl(e.target.value)}
              placeholder="https://example.com/product"
              disabled={publishing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publish-budget">Daily budget</Label>
            <Input
              id="publish-budget"
              type="number"
              min={1}
              step={1}
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              disabled={publishing}
            />
          </div>
          {provider === "meta" ? (
            <div className="space-y-1.5">
              <Label htmlFor="meta-page-id">Facebook Page ID</Label>
              <Input
                id="meta-page-id"
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value)}
                placeholder="Page ID for the ad"
                disabled={publishing}
              />
            </div>
          ) : creative.kind === "video_ad" ? (
            <div className="space-y-1.5">
              <Label htmlFor="youtube-video-id">YouTube video ID</Label>
              <Input
                id="youtube-video-id"
                value={youtubeVideoId}
                onChange={(e) => setYoutubeVideoId(e.target.value)}
                placeholder="Required for Google video ads"
                disabled={publishing}
              />
            </div>
          ) : (
            <div />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={publishing || providerConnections.length === 0}
            onClick={() => void publishCreative()}
          >
            {publishing ? "Publishing…" : "Publish paused campaign"}
          </Button>
          {providerConnections.length === 0 ? (
            <Link
              href="/settings/connections"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Connect an ad account in Settings
            </Link>
          ) : null}
        </div>
        {publishError ? (
          <p className="text-xs text-destructive">{publishError}</p>
        ) : null}
        {publishOk ? (
          <p className="text-xs text-muted-foreground">{publishOk}</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">External ad IDs</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved automatically on publish, or paste IDs if you uploaded ads
            outside Product Agent.
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
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="meta-ad-id">Meta ad ID</Label>
            <Input
              id="meta-ad-id"
              value={metaAdId}
              onChange={(e) => setMetaAdId(e.target.value)}
              placeholder="1202…"
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
            Publish above or paste an external ad ID, then sync performance from
            Settings → Connections. Metrics appear after ads start serving.
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
            {creative.stage === "storyboard" ? "Generate video" : "Accept"}
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
            {creative.stage === "storyboard"
              ? "Ready to generate video"
              : `Reviewing ${stageLabel(creative.stage).toLowerCase()}`}
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
    if (initialTab && isKnownTab(initialTab, initial)) return initialTab;
    return defaultTab(initial);
  });
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setCreative(initial);
    setTitleDraft(initial.title);
    setTab((current) =>
      isKnownTab(current, initial) ? current : defaultTab(initial),
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
          const finishedPrep =
            creative.status === "generating" &&
            body.creative.status === "awaiting_review" &&
            body.creative.stage === "storyboard" &&
            body.creative.kind === "video_ad";
          setCreative(body.creative);
          if (finishedPrep) {
            setTab("video");
          } else {
            setTab((current) =>
              isKnownTab(current, body.creative!)
                ? current
                : defaultTab(body.creative!),
            );
          }
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
    if (action === "accept" && creative.stage === "storyboard") {
      setTab("video");
    } else {
      setTab((current) =>
        isKnownTab(current, body.creative) ? current : defaultTab(body.creative),
      );
    }

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

  async function renameCreative(nextTitle: string) {
    const title = nextTitle.trim();
    if (!title || title === creative.title) {
      setTitleOpen(false);
      setTitleDraft(creative.title);
      return;
    }
    setError(null);
    setRenaming(true);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", title }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Rename failed");
        return;
      }
      const body = (await res.json()) as { creative: Creative };
      setCreative(body.creative);
      setTitleDraft(body.creative.title);
      setTitleOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setRenaming(false);
    }
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
        if (isKnownTab(value, creative)) {
          setTab(value);
        }
      }}
      className="h-full gap-0"
    >
      <PageCanvas
        headerHeightClassName="h-14"
        contentTopClassName="top-14"
        headerClassName="border-b-0 bg-black backdrop-blur-none supports-backdrop-filter:bg-black"
        contentClassName="flex flex-col overflow-hidden bg-black"
        header={
          <div className="relative flex w-full items-center">
            <div className="z-10 flex min-w-0 max-w-[34%] items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="-ml-1 size-7 shrink-0 rounded-md text-muted-foreground"
                aria-label="Back to creatives"
                render={<Link href="/creatives" />}
              >
                <ArrowLeft02Icon className="size-4" />
              </Button>
              <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                <Popover
                  open={titleOpen}
                  onOpenChange={(open) => {
                    setTitleOpen(open);
                    if (open) setTitleDraft(creative.title);
                  }}
                >
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="truncate rounded-md px-1.5 py-0.5 text-left text-sm font-medium hover:bg-white/5"
                      />
                    }
                  >
                    {creative.title}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 gap-3 p-3">
                    <PopoverHeader>
                      <PopoverTitle>Rename creative</PopoverTitle>
                    </PopoverHeader>
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void renameCreative(titleDraft);
                      }}
                    >
                      <Input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        maxLength={200}
                        disabled={renaming}
                        autoFocus
                        aria-label="Creative title"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={renaming}
                          onClick={() => setTitleOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={renaming || !titleDraft.trim()}
                        >
                          {renaming ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {statusLabel(creative.status)}
                </Badge>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 sm:px-28">
              <SlidingTabs
                className="pointer-events-auto"
                aria-label="Creative stages"
                value={tab}
                onValueChange={(value) => {
                  if (isKnownTab(value, creative)) setTab(value);
                }}
                items={tabItems(creative)}
              />
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
          <div className="min-h-0 flex-1 overflow-hidden bg-black pb-24">
            <TabsContent value="screenplay" className="mt-0 h-full overflow-hidden">
              {creative.screenplay ? (
                <ScreenplayView
                  creative={creative}
                  screenplay={creative.screenplay}
                  onCreativeChange={setCreative}
                />
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

            <TabsContent value="world" className="mt-0 h-full overflow-y-auto">
              <WorldView
                creative={creative}
                onCreativeChange={setCreative}
              />
            </TabsContent>

            <TabsContent value="storyboard" className="mt-0 h-full overflow-y-auto">
              <StoryboardView creative={creative} />
            </TabsContent>

            <TabsContent value="video" className="mt-0 h-full overflow-y-auto">
              <VideoView
                creative={creative}
                pending={pending}
                onGenerate={() => void mutate("accept")}
              />
            </TabsContent>

            <TabsContent value="concept" className="mt-0 h-full overflow-y-auto">
              <ConceptView creative={creative} />
            </TabsContent>

            <TabsContent value="assets" className="mt-0 h-full overflow-y-auto">
              <AssetsView creative={creative} />
            </TabsContent>

            <TabsContent value="copy" className="mt-0 h-full overflow-y-auto">
              <CopyView creative={creative} />
            </TabsContent>

            <TabsContent value="keywords" className="mt-0 h-full overflow-y-auto">
              <KeywordsView creative={creative} />
            </TabsContent>

            <TabsContent value="script" className="mt-0 h-full overflow-y-auto">
              <ScriptView creative={creative} />
            </TabsContent>

            <TabsContent value="audio" className="mt-0 h-full overflow-y-auto">
              <AudioSpotView creative={creative} />
            </TabsContent>

            <TabsContent value="distribution" className="mt-0 h-full overflow-y-auto">
              <DistributionView
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

      <CreativeFloatingPrompt
        creative={creative}
        activeTab={tab}
        productId={creative.productId}
        onCreativeChange={setCreative}
      />

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
