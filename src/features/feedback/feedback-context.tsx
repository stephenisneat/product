"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdminFeedbackKind } from "@/domain";
import { FeedbackDialog } from "@/features/feedback/feedback-dialog";
import { FeedbackPinOverlay } from "@/features/feedback/feedback-pin-overlay";
import {
  captureFeedbackScreenshot,
  type FeedbackPin,
} from "@/features/feedback/capture-feedback-screenshot";
import { toast } from "sonner";

export type FeedbackDraft = {
  kind: Extract<AdminFeedbackKind, "bug" | "feature">;
  title?: string;
  body?: string;
  screenshotBlob?: Blob | null;
  screenshotPreviewUrl?: string | null;
};

type FeedbackContextValue = {
  openFeedback: (draft?: Partial<FeedbackDraft>) => void;
  startPinMode: (point?: { x: number; y: number }) => void;
  recordContextPoint: (point: { x: number; y: number }) => void;
  lastContextPoint: () => { x: number; y: number } | null;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>({ kind: "bug" });
  const [pinMode, setPinMode] = useState<{
    active: boolean;
    x: number;
    y: number;
    radius: number;
    awaitingClick: boolean;
  }>({
    active: false,
    x: 0,
    y: 0,
    radius: 48,
    awaitingClick: false,
  });
  const [capturing, setCapturing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  function revokePreview(url: string | null | undefined) {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }

  function openFeedback(partial?: Partial<FeedbackDraft>) {
    setDraft((prev) => {
      const next: FeedbackDraft = {
        kind: partial?.kind ?? prev.kind ?? "bug",
        title: partial?.title ?? "",
        body: partial?.body ?? "",
        screenshotBlob:
          partial && "screenshotBlob" in partial
            ? (partial.screenshotBlob ?? null)
            : null,
        screenshotPreviewUrl:
          partial && "screenshotPreviewUrl" in partial
            ? (partial.screenshotPreviewUrl ?? null)
            : null,
      };
      if (prev.screenshotPreviewUrl !== next.screenshotPreviewUrl) {
        revokePreview(prev.screenshotPreviewUrl);
      }
      return next;
    });
    setDialogOpen(true);
  }

  function startPinMode(point?: { x: number; y: number }) {
    setDialogOpen(false);
    if (point) {
      setPinMode({
        active: true,
        x: point.x,
        y: point.y,
        radius: 48,
        awaitingClick: false,
      });
      return;
    }
    setPinMode({
      active: true,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: 48,
      awaitingClick: true,
    });
  }

  function recordContextPoint(point: { x: number; y: number }) {
    lastPointRef.current = point;
  }

  function lastContextPoint() {
    return lastPointRef.current;
  }

  async function confirmPin(pin: FeedbackPin) {
    setCapturing(true);
    try {
      const blob = await captureFeedbackScreenshot(pin);
      const previewUrl = URL.createObjectURL(blob);
      setPinMode((p) => ({ ...p, active: false, awaitingClick: false }));
      openFeedback({
        kind: draft.kind === "feature" ? "feature" : "bug",
        title: draft.title,
        body: draft.body,
        screenshotBlob: blob,
        screenshotPreviewUrl: previewUrl,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to capture screenshot",
      );
    } finally {
      setCapturing(false);
    }
  }

  const value: FeedbackContextValue = {
    openFeedback,
    startPinMode,
    recordContextPoint,
    lastContextPoint,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackDialog
        open={dialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onOpenChange={(open) => {
          if (!open) {
            revokePreview(draft.screenshotPreviewUrl);
            setDraft({ kind: "bug" });
          }
          setDialogOpen(open);
        }}
        onStartPin={() => startPinMode()}
      />
      {pinMode.active ? (
        <FeedbackPinOverlay
          x={pinMode.x}
          y={pinMode.y}
          radius={pinMode.radius}
          awaitingClick={pinMode.awaitingClick}
          capturing={capturing}
          onChange={(next) => setPinMode((p) => ({ ...p, ...next }))}
          onCancel={() =>
            setPinMode((p) => ({ ...p, active: false, awaitingClick: false }))
          }
          onConfirm={(pin) => void confirmPin(pin)}
        />
      ) : null}
    </FeedbackContext.Provider>
  );
}
