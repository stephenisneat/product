"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Creative, ScreenplayPayload } from "@/domain";
import { Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ScreenplayDocument,
  diffScreenplays,
  type ScreenplayFieldKey,
  type ScreenplayTextHighlight,
} from "@/features/creatives/screenplay-document";
import { cn } from "@/lib/utils";

/** US Letter page width in CSS pixels (8.5in at 96dpi). */
const BASE_SHEET_WIDTH_PX = 8.5 * 96;
/** Fraction of the scroll viewport the sheet should fill at max scale. */
const MAX_WIDTH_RATIO = 0.96;
const MIN_SCALE = 0.5;
const DEFAULT_SCALE_T = 0.55;

type CommentDraft = {
  selectedText: string;
  highlight: ScreenplayTextHighlight;
  comment: string;
  top: number;
  left: number;
};

type Proposal = {
  selectedText: string;
  highlight: ScreenplayTextHighlight;
  comment: string;
  summary: string;
  screenplay: ScreenplayPayload;
};

function fieldFromElement(
  el: Element | null,
): { sceneId: string | null; field: ScreenplayFieldKey } | null {
  const fieldEl = el?.closest("[data-screenplay-field]");
  if (!fieldEl) return null;
  const field = fieldEl.getAttribute("data-screenplay-field");
  const sceneRaw = fieldEl.getAttribute("data-scene-id");
  if (
    field !== "logline" &&
    field !== "heading" &&
    field !== "action" &&
    field !== "character" &&
    field !== "dialogue"
  ) {
    return null;
  }
  return {
    field,
    sceneId: !sceneRaw || sceneRaw === "meta" ? null : sceneRaw,
  };
}

function rangeOffsetsInField(
  range: Range,
  fieldEl: Element,
): { start: number; end: number } | null {
  try {
    const pre = range.cloneRange();
    pre.selectNodeContents(fieldEl);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const length = range.toString().length;
    return { start, end: start + length };
  } catch {
    return null;
  }
}

export function ScreenplayView({
  creative,
  screenplay,
  onCreativeChange,
}: {
  creative: Creative;
  screenplay: ScreenplayPayload;
  onCreativeChange: (creative: Creative) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [scaleT, setScaleT] = useState(DEFAULT_SCALE_T);
  const [maxScale, setMaxScale] = useState(1);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minScale = Math.min(MIN_SCALE, maxScale * 0.55);
  const scale = minScale + scaleT * Math.max(maxScale - minScale, 0);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const update = () => {
      const available = Math.max(scroll.clientWidth - 24, BASE_SHEET_WIDTH_PX * 0.5);
      const nextMax = Math.max(
        MIN_SCALE,
        (available * MAX_WIDTH_RATIO) / BASE_SHEET_WIDTH_PX,
      );
      setMaxScale(nextMax);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDraft(null);
        if (!submitting) setProposal(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitting]);

  useEffect(() => {
    if (!draft) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (composerRef.current?.contains(target)) return;
      setDraft(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [draft]);

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function handleMouseUp() {
    if (proposal || submitting) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const sheet = sheetRef.current;
    const scroll = scrollRef.current;
    if (!sheet || !scroll || !sheet.contains(range.commonAncestorContainer)) {
      return;
    }

    const startMeta = fieldFromElement(
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement,
    );
    const endMeta = fieldFromElement(
      range.endContainer.nodeType === Node.ELEMENT_NODE
        ? (range.endContainer as Element)
        : range.endContainer.parentElement,
    );
    if (
      !startMeta ||
      !endMeta ||
      startMeta.field !== endMeta.field ||
      startMeta.sceneId !== endMeta.sceneId
    ) {
      return;
    }

    const fieldEl = (
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement
    )?.closest("[data-screenplay-field]");
    if (!fieldEl || !sheet.contains(fieldEl)) return;

    const offsets = rangeOffsetsInField(range, fieldEl);
    if (!offsets || offsets.end - offsets.start < 2) return;

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (selectedText.length < 2) return;

    const rect = range.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const top = rect.bottom - scrollRect.top + scroll.scrollTop + 8;
    const left = Math.min(
      Math.max(rect.left - scrollRect.left + scroll.scrollLeft, 12),
      Math.max(scroll.clientWidth - 320, 12),
    );

    setError(null);
    setDraft({
      selectedText,
      highlight: {
        sceneId: startMeta.sceneId,
        field: startMeta.field,
        start: offsets.start,
        end: offsets.end,
      },
      comment: "",
      top,
      left,
    });
  }

  async function submitComment() {
    if (!draft?.comment.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_screenplay_edit",
          selectedText: draft.selectedText,
          comment: draft.comment.trim(),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        proposedScreenplay?: ScreenplayPayload;
        summary?: string;
      } | null;
      if (!res.ok || !body?.proposedScreenplay) {
        setError(body?.error ?? "Could not process comment.");
        return;
      }
      setProposal({
        selectedText: draft.selectedText,
        highlight: draft.highlight,
        comment: draft.comment.trim(),
        summary: body.summary ?? "Proposed edit",
        screenplay: body.proposedScreenplay,
      });
      setDraft(null);
      clearSelection();
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptProposal() {
    if (!proposal) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_screenplay",
          screenplay: proposal.screenplay,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        creative?: Creative;
      } | null;
      if (!res.ok || !body?.creative) {
        setError(body?.error ?? "Could not apply edit.");
        return;
      }
      onCreativeChange(body.creative);
      setProposal(null);
    } finally {
      setSubmitting(false);
    }
  }

  function rejectProposal() {
    setProposal(null);
    setError(null);
  }

  const displayScreenplay = proposal?.screenplay ?? screenplay;
  const diffs = proposal
    ? diffScreenplays(screenplay, proposal.screenplay)
    : undefined;
  const activeHighlight =
    proposal?.highlight ?? draft?.highlight ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-8 sm:px-6"
        onMouseUp={handleMouseUp}
      >
        <div
          ref={sheetRef}
          className="mx-auto w-full max-w-[8.5in]"
          style={{ zoom: scale }}
        >
          <ScreenplayDocument
            screenplay={displayScreenplay}
            className="max-w-none"
            highlight={activeHighlight}
            diffs={diffs}
          />
        </div>

        {draft ? (
          <div
            ref={composerRef}
            className="absolute z-20 w-[min(100%-1.5rem,20rem)] rounded-lg border border-border bg-neutral-950 p-3 shadow-xl"
            style={{ top: draft.top, left: draft.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="mb-2 line-clamp-2 text-[11px] text-neutral-400">
              “{draft.selectedText}”
            </p>
            <Textarea
              autoFocus
              rows={3}
              className="min-h-16 border-white/10 bg-neutral-900 text-xs text-neutral-100"
              placeholder="Add a comment…"
              value={draft.comment}
              disabled={submitting}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, comment: e.target.value } : current,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
            />
            {error && !proposal ? (
              <p className="mt-2 text-[11px] text-destructive">{error}</p>
            ) : null}
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                size="xs"
                variant="ghost"
                disabled={submitting}
                onClick={() => {
                  setDraft(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                disabled={submitting || !draft.comment.trim()}
                onClick={() => void submitComment()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Thinking…
                  </>
                ) : (
                  "Comment"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {proposal ? (
        <div className="shrink-0 border-t border-border bg-neutral-950 px-4 py-3">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
            <p className="text-xs text-neutral-300">{proposal.summary}</p>
            <p className="text-[11px] text-neutral-500">
              Comment on “{proposal.selectedText.slice(0, 80)}
              {proposal.selectedText.length > 80 ? "…" : ""}”:{" "}
              {proposal.comment}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => void acceptProposal()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Accept edit"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={rejectProposal}
              >
                Reject
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {diffs?.length ?? 0} change
                {(diffs?.length ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-border bg-black px-4 py-2">
        <div className="flex w-full items-center justify-end gap-2">
          <input
            id="screenplay-scale"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scaleT}
            aria-label="Screenplay scale"
            onChange={(e) => setScaleT(Number(e.target.value))}
            className={cn(
              "h-1 w-24 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-neutral-200",
            )}
          />
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
