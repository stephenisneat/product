"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import type { Insight } from "@/domain";
import { isApplyDeliverableAction } from "@/domain";
import { Check, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/features/insights/insight-card";
import { cn } from "@/lib/utils";

const VISIBLE_DEPTH = 3;
const CARD_HEIGHT_PX = 420;
const SWIPE_THRESHOLD = 110;
const EXIT_DISTANCE = 520;
const EXIT_MS = 280;

type ExitDir = "left" | "right" | null;

function stackStyle(depth: number): CSSProperties {
  const clamped = Math.min(depth, VISIBLE_DEPTH - 1);
  return {
    transform: `translateY(${clamped * 12}px) scale(${1 - clamped * 0.045})`,
    opacity: Math.max(0, 1 - clamped * 0.32),
    zIndex: VISIBLE_DEPTH - depth,
  };
}

export function InsightCardStack({
  insights,
  productTitle,
}: {
  insights: Insight[];
  productTitle: string;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(insights);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDir, setExitDir] = useState<ExitDir>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragXRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const axisRef = useRef<"undecided" | "x" | "y">("undecided");
  const pointerIdRef = useRef<number | null>(null);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (exitingRef.current) return;
    setQueue(insights);
  }, [insights]);

  const top = queue[0];
  const canSwipe = Boolean(top && top.status === "awaiting_review" && !busy);

  async function decide(action: "accept" | "reject", insight: Insight) {
    setError(null);
    const res = await fetch(`/api/insights/${insight.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Request failed");
    }
  }

  function finishExit(dir: "left" | "right") {
    const insight = queue[0];
    if (!insight || exitingRef.current || insight.status !== "awaiting_review") {
      return;
    }

    exitingRef.current = true;
    setBusy(true);
    setError(null);
    setExitDir(dir);
    setDragging(false);
    setDragX(dir === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE);

    const action = dir === "right" ? "accept" : "reject";

    window.setTimeout(() => {
      setQueue((prev) => prev.filter((i) => i.id !== insight.id));
      setExitDir(null);
      setDragX(0);
      exitingRef.current = false;
      setBusy(false);

      void (async () => {
        try {
          await decide(action, insight);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Request failed");
          setQueue((prev) =>
            prev.some((i) => i.id === insight.id)
              ? prev
              : [insight, ...prev],
          );
        }
      })();
    }, EXIT_MS);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!canSwipe || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, textarea, input, [role='button']")) return;

    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    dragXRef.current = 0;
    axisRef.current = "undecided";
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (axisRef.current === "undecided") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisRef.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      if (axisRef.current === "y") {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // already released
        }
        pointerIdRef.current = null;
        return;
      }
      setDragging(true);
    }

    if (axisRef.current !== "x") return;
    dragXRef.current = dx;
    setDragX(dx);
  }

  function endPointer(e: PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }

    const wasHorizontal = axisRef.current === "x";
    axisRef.current = "undecided";
    const dx = dragXRef.current;
    setDragging(false);

    if (!wasHorizontal) {
      setDragX(0);
      return;
    }

    if (dx >= SWIPE_THRESHOLD) {
      finishExit("right");
    } else if (dx <= -SWIPE_THRESHOLD) {
      finishExit("left");
    } else {
      setDragX(0);
    }
  }

  if (!top) {
    return (
      <p className="text-sm text-muted-foreground">All caught up for now.</p>
    );
  }

  const acceptLabel = isApplyDeliverableAction(top.action)
    ? (top.action.label ?? "Accept & apply")
    : "Accept";

  const visible = queue.slice(0, VISIBLE_DEPTH);
  const rotation = dragX * 0.04;
  const acceptHint = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
  const rejectHint = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5">
      <div
        className="relative w-full"
        style={{ height: CARD_HEIGHT_PX + (VISIBLE_DEPTH - 1) * 12 }}
      >
        {visible
          .map((insight, index) => ({ insight, depth: index }))
          .reverse()
          .map(({ insight, depth }) => {
            const isTop = depth === 0;
            const base = stackStyle(depth);
            const style: CSSProperties = isTop
              ? {
                  ...base,
                  transform:
                    exitDir || dragging || dragX
                      ? `translateX(${dragX}px) rotate(${rotation}deg)`
                      : (base.transform as string),
                  opacity: exitDir ? 0.85 : base.opacity,
                  transition:
                    dragging && !exitDir
                      ? undefined
                      : `transform ${EXIT_MS}ms ease, opacity ${EXIT_MS}ms ease`,
                  touchAction: "pan-y",
                }
              : {
                  ...base,
                  transition: "transform 200ms ease, opacity 200ms ease",
                };

            return (
              <div
                key={insight.id}
                className={cn(
                  "absolute inset-x-0 top-0",
                  isTop && canSwipe && "cursor-grab active:cursor-grabbing",
                )}
                style={{ ...style, height: CARD_HEIGHT_PX }}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? endPointer : undefined}
                onPointerCancel={isTop ? endPointer : undefined}
              >
                {isTop && (acceptHint > 0 || rejectHint > 0) ? (
                  <>
                    <div
                      className="pointer-events-none absolute top-4 left-4 z-10 rounded-md border-2 border-emerald-500 px-2 py-1 text-xs font-semibold tracking-wide text-emerald-500 uppercase"
                      style={{ opacity: acceptHint }}
                    >
                      Accept
                    </div>
                    <div
                      className="pointer-events-none absolute top-4 right-4 z-10 rounded-md border-2 border-destructive px-2 py-1 text-xs font-semibold tracking-wide text-destructive uppercase"
                      style={{ opacity: rejectHint }}
                    >
                      Reject
                    </div>
                  </>
                ) : null}
                <InsightCard
                  insight={insight}
                  productTitle={productTitle}
                  hideReviewActions
                  className="h-full overflow-y-auto overflow-x-hidden bg-card shadow-lg"
                />
              </div>
            );
          })}
      </div>

      {error ? (
        <p className="text-center text-xs text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          className="size-14 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={!canSwipe}
          aria-label="Reject insight"
          onClick={() => finishExit("left")}
        >
          <X className="size-6" />
        </Button>
        <Button
          type="button"
          size="icon-lg"
          className="size-14 rounded-full"
          disabled={!canSwipe}
          aria-label={acceptLabel}
          onClick={() => finishExit("right")}
        >
          <Check className="size-6" />
        </Button>
      </div>

      {queue.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          {queue.length} insights to review · swipe or use the buttons
        </p>
      ) : top.status === "awaiting_review" ? (
        <p className="text-xs text-muted-foreground">
          Swipe right to accept · left to reject
        </p>
      ) : null}
    </div>
  );
}
