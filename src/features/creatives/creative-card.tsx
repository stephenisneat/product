"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, Loader2 } from "@/components/icons";
import { useEffect, useState, useTransition } from "react";
import type { Creative } from "@/domain";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { cn } from "@/lib/utils";

function kindBadgeLabel(kind: Creative["kind"]): string {
  switch (kind) {
    case "display_ad":
      return "Display";
    case "search_ad":
      return "Search";
    default:
      return "Video";
  }
}

function previewThumbnail(creative: Creative): string | null {
  if (creative.assets?.marketingImageUrl) {
    return creative.assets.marketingImageUrl;
  }
  if (creative.assets?.squareImageUrl) {
    return creative.assets.squareImageUrl;
  }
  if (creative.video?.thumbnailUrl) return creative.video.thumbnailUrl;
  const frames = creative.storyboard?.frames;
  if (frames && frames.length > 0) {
    return frames[frames.length - 1]!.imageUrl;
  }
  return null;
}

function CreativePreviewMedia({ creative }: { creative: Creative }) {
  const thumbnail = previewThumbnail(creative);
  const isWorking =
    creative.status === "generating" || creative.status === "revising";

  if (thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail}
        alt=""
        className="size-full object-cover"
      />
    );
  }

  if (creative.copy) {
    return (
      <div className="flex size-full flex-col justify-end bg-gradient-to-b from-muted/40 to-muted/80 p-3">
        <p className="line-clamp-2 text-xs font-medium text-foreground">
          {creative.copy.headlines[0]}
        </p>
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-muted-foreground">
          {creative.copy.descriptions[0]}
        </p>
      </div>
    );
  }

  if (creative.concept) {
    return (
      <div className="flex size-full flex-col justify-end bg-gradient-to-b from-muted/40 to-muted/80 p-3">
        <p className="line-clamp-2 text-xs font-medium text-foreground">
          {creative.concept.longHeadline}
        </p>
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-muted-foreground">
          {creative.concept.headlines.join(" · ")}
        </p>
      </div>
    );
  }

  if (creative.screenplay) {
    return (
      <div className="flex size-full flex-col justify-end bg-gradient-to-b from-muted/40 to-muted/80 p-3">
        <p className="line-clamp-2 text-xs font-medium text-foreground">
          {creative.screenplay.logline}
        </p>
        <pre className="mt-1.5 line-clamp-4 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
          {creative.screenplay.script}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex size-full items-center justify-center bg-muted/50 text-xs text-muted-foreground">
      {isWorking ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          Generating…
        </span>
      ) : (
        "No preview yet"
      )}
    </div>
  );
}

function CardFooterActions({
  creative,
  pending,
  revising,
  feedback,
  onFeedbackChange,
  onReviseToggle,
  onAction,
}: {
  creative: Creative;
  pending: boolean;
  revising: boolean;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onReviseToggle: (open: boolean) => void;
  onAction: (
    action: "accept" | "reject" | "revise" | "resubmit" | "reopen",
  ) => void;
}) {
  if (creative.status === "generating") {
    return (
      <div className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Working…
      </div>
    );
  }

  if (creative.status === "ready") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        render={<Link href={`/creatives/${creative.id}?tab=performance`} />}
      >
        View performance
      </Button>
    );
  }

  if (creative.status === "rejected") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() => onAction("reopen")}
      >
        Reopen
      </Button>
    );
  }

  if (creative.status === "revising") {
    return (
      <div className="space-y-2">
        <Textarea
          className="text-xs"
          rows={3}
          placeholder="What should change?"
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      </div>
    );
  }

  if (creative.status !== "awaiting_review") {
    return null;
  }

  return (
    <div className="space-y-2">
      {revising ? (
        <Textarea
          className="text-xs"
          rows={3}
          placeholder="What should change?"
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
        />
      ) : null}
      <div className="flex flex-wrap gap-1.5">
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
      </div>
    </div>
  );
}

export function CreativeCard({
  creative: initial,
  compact = false,
  pollWhileGenerating = true,
  onDeleted,
}: {
  creative: Creative;
  compact?: boolean;
  pollWhileGenerating?: boolean;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [creative, setCreative] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  }, [creative.id, creative.status, pollWhileGenerating, router]);

  async function mutate(
    action: "accept" | "reject" | "revise" | "resubmit" | "reopen",
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
      onDeleted?.(creative.id);
      startTransition(() => {
        if (!onDeleted) {
          router.push("/creatives");
        }
        router.refresh();
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card/40",
        compact && "max-w-md",
      )}
    >
      <div className="relative aspect-video bg-muted">
        <Link
          href={`/creatives/${creative.id}`}
          className="absolute inset-0 block"
          aria-label={`Open ${creative.title}`}
        >
          <CreativePreviewMedia creative={creative} />
        </Link>

        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon-xs"
                  className="bg-background/90 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/75"
                  aria-label="Creative actions"
                />
              }
            >
              <Ellipsis className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem
                variant="destructive"
                disabled={pending || deleting}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-1.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
            <Link
              href={`/creatives/${creative.id}`}
              className="hover:underline"
            >
              {creative.title}
            </Link>
          </h3>
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {kindBadgeLabel(creative.kind)}
          </span>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <CardFooterActions
          creative={creative}
          pending={pending}
          revising={revising}
          feedback={feedback}
          onFeedbackChange={setFeedback}
          onReviseToggle={(open) => {
            setRevising(open);
            if (!open) setFeedback("");
          }}
          onAction={(action) => void mutate(action)}
        />
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete creative?"
        description={`“${creative.title}” will be permanently deleted, and any in-progress generation on Trigger.dev will be canceled. This cannot be undone.`}
        pending={deleting}
        onConfirm={removeCreative}
      />
    </article>
  );
}
