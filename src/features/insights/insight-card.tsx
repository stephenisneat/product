"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "@/components/icons";
import { useEffect, useState, useTransition } from "react";
import type { Insight } from "@/domain";
import { isApplyDeliverableAction } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/features/agent/agent-context";
import { cn } from "@/lib/utils";

function statusLabel(status: Insight["status"]): string {
  switch (status) {
    case "generating":
      return "Generating";
    case "awaiting_review":
      return "Awaiting review";
    case "revising":
      return "Revising";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
  }
}

function elaboratePrompt(insight: Insight): string {
  const parts = [
    `Elaborate on insight "${insight.title}" (id ${insight.id}).`,
  ];
  if (insight.summary?.trim()) {
    parts.push(`Summary: ${insight.summary.trim()}`);
  }
  if (insight.rationale?.trim()) {
    parts.push(`Rationale: ${insight.rationale.trim()}`);
  }
  parts.push(
    "Expand on the evidence, implications, and how we should act on this.",
  );
  return parts.join("\n\n");
}

export function InsightCard({
  insight: initial,
  compact = false,
  pollWhileGenerating = true,
  rowOnDesktop = false,
  productTitle,
  goalTitle,
  className,
  hideReviewActions = false,
}: {
  insight: Insight;
  compact?: boolean;
  pollWhileGenerating?: boolean;
  rowOnDesktop?: boolean;
  productTitle?: string | null;
  goalTitle?: string | null;
  className?: string;
  /** Hide Accept/Reject (and revise UI); stack or parent owns those actions. */
  hideReviewActions?: boolean;
}) {
  const router = useRouter();
  const { setComposePrefill } = useAgentContext();
  const [insight, setInsight] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    setInsight(initial);
  }, [initial]);

  useEffect(() => {
    if (!pollWhileGenerating || insight.status !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/insights/${insight.id}`);
        if (!res.ok) return;
        const body = (await res.json()) as { insight?: Insight };
        if (!cancelled && body.insight) {
          setInsight(body.insight);
          if (body.insight.status !== "generating") {
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
  }, [insight.id, insight.status, pollWhileGenerating, router]);

  async function mutate(action: "accept" | "reject" | "revise" | "do_it") {
    setError(null);
    setActionNote(null);
    const res = await fetch(`/api/insights/${insight.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        feedback:
          action === "revise" ? feedback.trim() || undefined : undefined,
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
      insight: Insight;
      revisePrompt?: string;
      result?: {
        type?: string;
        prefill?: string;
        jobId?: string;
        creativeId?: string;
        deliverableType?: string;
      };
    };
    setInsight(body.insight);

    if (action === "revise" && body.revisePrompt) {
      setComposePrefill(body.revisePrompt);
      setRevising(false);
      setFeedback("");
    }

    if (action === "do_it" && body.result) {
      if (body.result.type === "open_chat" && body.result.prefill) {
        setComposePrefill(body.result.prefill);
        setActionNote("Opened in chat compose.");
      } else if (body.result.type === "create_campaign" && body.result.jobId) {
        setActionNote(`Campaign job started (${body.result.jobId.slice(0, 8)}…).`);
      } else if (
        body.result.type === "create_video_creative" &&
        body.result.creativeId
      ) {
        setActionNote(`Video creative started.`);
      }
    }

    if (action === "accept" && body.result?.type === "apply_deliverable") {
      setActionNote("Deliverable applied.");
    }

    startTransition(() => router.refresh());
  }

  const canReview = insight.status === "awaiting_review";
  const canDoIt =
    insight.status === "accepted" &&
    insight.action &&
    !isApplyDeliverableAction(insight.action);

  const deliverablePayload =
    isApplyDeliverableAction(insight.action) &&
    insight.action.payload.payload &&
    typeof insight.action.payload.payload === "object"
      ? (insight.action.payload.payload as Record<string, unknown>)
      : null;
  const deliverableType =
    isApplyDeliverableAction(insight.action) &&
    typeof insight.action.payload.type === "string"
      ? insight.action.payload.type
      : null;

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card/40 p-3",
        compact && "max-w-md",
        rowOnDesktop &&
          "md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:px-4 md:py-3 md:hover:bg-white/[0.06]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          rowOnDesktop && "md:items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            {insight.title || "Untitled insight"}
          </h3>
          {insight.summary ? (
            <p
              className={cn(
                "mt-1 line-clamp-3 text-xs text-muted-foreground",
                rowOnDesktop && "md:line-clamp-1",
              )}
            >
              {insight.summary}
            </p>
          ) : null}
        </div>
        <Badge
          variant={insight.status === "accepted" ? "default" : "outline"}
          className="shrink-0 text-[10px] uppercase"
        >
          {statusLabel(insight.status)}
        </Badge>
      </div>

      <div
        className={cn(
          "mt-2 flex flex-wrap gap-1",
          rowOnDesktop && "md:mt-1.5",
        )}
      >
        {goalTitle ? (
          <Badge variant="secondary" className="text-[10px]">
            {goalTitle}
          </Badge>
        ) : null}
        {productTitle ? (
          <Badge variant="outline" className="text-[10px]">
            {productTitle}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px] uppercase">
          {insight.triggerSource}
        </Badge>
        {deliverableType ? (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {deliverableType.replace("_", " ")}
          </Badge>
        ) : null}
      </div>

      {insight.rationale ? (
        <p
          className={cn(
            "mt-3 text-xs leading-relaxed text-muted-foreground",
            rowOnDesktop && "md:mt-1.5 md:line-clamp-2",
          )}
        >
          {insight.rationale}
        </p>
      ) : null}

      {deliverablePayload ? (
        <pre
          className={cn(
            "mt-3 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground",
            rowOnDesktop && "md:hidden",
          )}
        >
          {JSON.stringify(deliverablePayload, null, 2)}
        </pre>
      ) : null}

      {insight.status === "generating" ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Generating insight…
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {actionNote ? (
        <p className="mt-2 text-xs text-muted-foreground">{actionNote}</p>
      ) : null}

      {canReview && !hideReviewActions ? (
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
              {isApplyDeliverableAction(insight.action)
                ? (insight.action.label ?? "Accept & apply")
                : "Accept"}
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
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setRevising(true)}
                >
                  Revise
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setComposePrefill(elaboratePrompt(insight))}
                >
                  Elaborate
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {canDoIt ? (
        <div className="mt-3">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void mutate("do_it")}
          >
            {insight.action?.label ?? "Do it"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
