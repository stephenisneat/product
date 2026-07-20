"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ellipsis,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { Creative, PerformancePoint, Product } from "@/domain";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { CampaignAssociation } from "@/features/campaigns/campaign-association";
import { ScreenplayDocument } from "@/features/creatives/screenplay-document";
import { PerformanceChartLazy } from "@/features/reporting/performance-chart-lazy";
import { cn } from "@/lib/utils";

type CreativeTab = "screenplay" | "storyboard" | "video" | "performance";

const STAGE_ORDER = ["screenplay", "storyboard", "video"] as const;

function stageLabel(stage: Creative["stage"]): string {
  switch (stage) {
    case "screenplay":
      return "Screenplay";
    case "storyboard":
      return "Storyboard";
    case "video":
      return "Video";
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

function stageIndex(stage: Creative["stage"]) {
  return STAGE_ORDER.indexOf(stage);
}

function isTabEnabled(tab: CreativeTab, creative: Creative): boolean {
  if (tab === "performance") {
    return creative.status === "ready";
  }
  const tabIdx = STAGE_ORDER.indexOf(tab);
  const currentIdx = stageIndex(creative.stage);
  if (tabIdx < 0) return false;
  // Current and prior stages are reachable; later stages unlock once payload exists.
  if (tabIdx <= currentIdx) return true;
  if (tab === "storyboard") return Boolean(creative.storyboard);
  if (tab === "video") return Boolean(creative.video);
  return false;
}

function defaultTab(creative: Creative): CreativeTab {
  if (isTabEnabled(creative.stage, creative)) return creative.stage;
  if (creative.screenplay) return "screenplay";
  return "screenplay";
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
  const video = creative.video;
  if (!video) {
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-10">
      <video
        className="aspect-[9/16] max-h-[70vh] w-full rounded-lg bg-black object-contain"
        controls
        poster={video.thumbnailUrl}
        src={video.url}
      />
      <p className="font-mono text-xs text-muted-foreground">
        {video.durationSec}s · {video.aspectRatio}
      </p>
    </div>
  );
}

function PerformanceView({
  creative,
  performance,
}: {
  creative: Creative;
  performance: PerformancePoint[];
}) {
  if (creative.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
        Performance unlocks when this creative is ready for campaigns.
      </div>
    );
  }

  if (performance.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
        No performance data yet. Launch this creative in a campaign to track
        results.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <PerformanceChartLazy data={performance} />
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
  onAction: (action: "accept" | "reject" | "revise") => void;
}) {
  if (creative.status !== "awaiting_review") return null;

  return (
    <div className="shrink-0 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-canvas/80">
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
}: {
  creative: Creative;
  product: Product | null;
  performance?: PerformancePoint[];
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [creative, setCreative] = useState(initial);
  const [tab, setTab] = useState<CreativeTab>(() => defaultTab(initial));
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    action: "accept" | "reject" | "revise" | "pause" | "resume",
  ) {
    setError(null);
    const res = await fetch(`/api/creatives/${creative.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        feedback: action === "revise" ? feedback.trim() || undefined : undefined,
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

    startTransition(() => router.refresh());
  }

  async function removeCreative() {
    setError(null);
    const res = await fetch(`/api/creatives/${creative.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Delete failed");
      return;
    }
    startTransition(() => {
      router.push("/creatives");
      router.refresh();
    });
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
                  {statusLabel(creative.status)}
                </Badge>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 sm:px-28">
              <TabsList
                variant="line"
                className="pointer-events-auto h-auto max-w-full gap-0 overflow-x-auto bg-transparent p-0"
              >
                {(
                  [
                    ["screenplay", "Screenplay"],
                    ["storyboard", "Storyboard"],
                    ["video", "Video"],
                    ["performance", "Performance"],
                  ] as const
                ).map(([value, label]) => {
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
                    disabled={pending}
                    onClick={() => void removeCreative()}
                  >
                    Delete creative
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        }
        contentClassName="flex flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {(product || creative.brief) && tab !== "screenplay" ? (
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

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="screenplay" className="mt-0 h-full">
              {creative.screenplay ? (
                <div className="min-h-full bg-[#e8e6e1] px-3 py-8 sm:px-6">
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

            <TabsContent value="performance" className="mt-0">
              <PerformanceView
                creative={creative}
                performance={performance}
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
    </Tabs>
  );
}
