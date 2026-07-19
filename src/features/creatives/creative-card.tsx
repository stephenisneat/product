"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { Creative } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { cn } from "@/lib/utils";

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
    case "rejected":
      return "Rejected";
    case "ready":
      return "Ready for campaigns";
  }
}

function CreativePreview({ creative }: { creative: Creative }) {
  if (creative.stage === "screenplay" && creative.screenplay) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-foreground">
          {creative.screenplay.logline}
        </p>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {creative.screenplay.script}
        </pre>
      </div>
    );
  }

  if (creative.stage === "storyboard" && creative.storyboard) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          {creative.storyboard.styleBrief}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {creative.storyboard.frames.map((frame) => (
            <figure
              key={`${frame.sceneId}-${frame.shotDescription.slice(0, 12)}`}
              className="overflow-hidden rounded-md border border-border bg-muted/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.imageUrl}
                alt={frame.shotDescription}
                className="aspect-[9/16] w-full object-cover"
              />
              <figcaption className="space-y-0.5 p-1.5">
                <p className="line-clamp-2 text-[10px] leading-snug text-foreground">
                  {frame.shotDescription}
                </p>
                <p className="text-[10px] text-muted-foreground">{frame.camera}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  if (creative.stage === "video" && creative.video) {
    return (
      <div className="mt-3 space-y-2">
        <video
          className="aspect-[9/16] max-h-80 w-full rounded-md bg-black object-contain"
          controls
          poster={creative.video.thumbnailUrl}
          src={creative.video.url}
        />
        <p className="text-[11px] text-muted-foreground">
          {creative.video.durationSec}s · {creative.video.aspectRatio}
        </p>
      </div>
    );
  }

  if (creative.status === "generating") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Generating {stageLabel(creative.stage).toLowerCase()}…
      </div>
    );
  }

  return (
    <p className="mt-3 text-xs text-muted-foreground">
      No {stageLabel(creative.stage).toLowerCase()} output yet.
    </p>
  );
}

export function CreativeCard({
  creative: initial,
  compact = false,
  pollWhileGenerating = true,
}: {
  creative: Creative;
  compact?: boolean;
  pollWhileGenerating?: boolean;
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [creative, setCreative] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCreative(initial);
  }, [initial]);

  useEffect(() => {
    if (!pollWhileGenerating || creative.status !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/creatives/${creative.id}`);
        if (!res.ok) return;
        const body = (await res.json()) as { creative?: Creative };
        if (!cancelled && body.creative) {
          setCreative(body.creative);
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
  }, [
    creative.id,
    creative.status,
    pollWhileGenerating,
    router,
  ]);

  async function mutate(action: "accept" | "reject" | "revise") {
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

    if (action === "revise" && body.revisePrompt) {
      setComposePrefill(body.revisePrompt);
      setRevising(false);
      setFeedback("");
    }

    startTransition(() => router.refresh());
  }

  const canReview = creative.status === "awaiting_review";

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card/40 p-3",
        compact && "max-w-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">
            <Link
              href={`/creatives/${creative.id}`}
              className="hover:underline"
            >
              {creative.title}
            </Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {creative.brief}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Badge variant="outline" className="text-[10px] uppercase">
            {stageLabel(creative.stage)}
          </Badge>
          <Badge
            variant={creative.status === "ready" ? "default" : "outline"}
            className="text-[10px] uppercase"
          >
            {statusLabel(creative.status)}
          </Badge>
        </div>
      </div>

      <CreativePreview creative={creative} />

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {canReview ? (
        <div className="mt-3 space-y-2">
          {revising ? (
            <Textarea
              className="text-xs"
              rows={3}
              placeholder="What should change?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => void mutate("accept")}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void mutate("reject")}
            >
              Reject
            </Button>
            {revising ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void mutate("revise")}
                >
                  Send to chat
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setRevising(false);
                    setFeedback("");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setRevising(true)}
              >
                Revise
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
