"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FEEDBACK_UI_ATTR } from "@/features/feedback/capture-feedback-screenshot";
import type { FeedbackPin } from "@/features/feedback/capture-feedback-screenshot";

const MIN_RADIUS = 24;
const MAX_RADIUS = 160;

export function FeedbackPinOverlay({
  x,
  y,
  radius,
  awaitingClick,
  capturing,
  onChange,
  onCancel,
  onConfirm,
}: {
  x: number;
  y: number;
  radius: number;
  awaitingClick: boolean;
  capturing: boolean;
  onChange: (next: {
    x?: number;
    y?: number;
    radius?: number;
    awaitingClick?: boolean;
  }) => void;
  onCancel: () => void;
  onConfirm: (pin: FeedbackPin) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && !awaitingClick && !capturing) {
        e.preventDefault();
        onConfirm({ x, y, radius });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [awaitingClick, capturing, onCancel, onConfirm, radius, x, y]);

  return (
    <div
      {...{ [FEEDBACK_UI_ATTR]: "" }}
      className="fixed inset-0 z-[100]"
      style={{ cursor: awaitingClick ? "crosshair" : "default" }}
      onClick={(e) => {
        if (!awaitingClick || capturing) return;
        onChange({
          x: e.clientX,
          y: e.clientY,
          awaitingClick: false,
        });
      }}
    >
      {/* Dim outside the circle via SVG mask */}
      <svg className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <mask id="feedback-pin-mask">
            <rect width="100%" height="100%" fill="white" />
            <circle cx={x} cy={y} r={radius} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#feedback-pin-mask)"
        />
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke="#ef4444"
          strokeWidth={3}
        />
        <line
          x1={x - 10}
          y1={y}
          x2={x + 10}
          y2={y}
          stroke="#ef4444"
          strokeWidth={2}
        />
        <line
          x1={x}
          y1={y - 10}
          x2={x}
          y2={y + 10}
          stroke="#ef4444"
          strokeWidth={2}
        />
      </svg>

      {/* Drag handle for repositioning when placed */}
      {!awaitingClick ? (
        <button
          type="button"
          aria-label="Move pin"
          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-red-500 bg-red-500/30 active:cursor-grabbing"
          style={{ left: x, top: y }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const move = (ev: PointerEvent) => {
              onChange({ x: ev.clientX, y: ev.clientY });
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
      ) : null}

      <div
        className="absolute inset-x-0 bottom-6 z-[101] mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-medium">
            {awaitingClick
              ? "Click where the issue is"
              : "Adjust the circle, then capture"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Esc to cancel · Enter to capture
          </p>
        </div>
        {!awaitingClick ? (
          <div className="space-y-2">
            <Label htmlFor="feedback-pin-radius" className="text-xs">
              Circle size
            </Label>
            <input
              id="feedback-pin-radius"
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radius}
              onChange={(e) => onChange({ radius: Number(e.target.value) })}
              className="w-full accent-red-500"
              disabled={capturing}
            />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={capturing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={awaitingClick || capturing}
            onClick={() => onConfirm({ x, y, radius })}
          >
            {capturing ? "Capturing…" : "Capture & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
