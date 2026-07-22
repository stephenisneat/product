"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CrosshairIcon, LifebuoyIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFeedback } from "@/features/feedback/feedback-context";
import { getCurrentUserIdForUpload } from "@/features/feedback/get-upload-user-id";
import { uploadFeedbackScreenshot } from "@/features/feedback/upload-feedback-screenshot";

export function FeedbackHeaderMenu() {
  const {
    menuOpen,
    setMenuOpen,
    draft,
    setDraft,
    startPinMode,
    resetDraft,
  } = useFeedback();
  const [saving, setSaving] = useState(false);

  async function submit() {
    const message = (draft.title ?? "").trim();
    if (!message) {
      toast.error("Add a short note");
      return;
    }
    setSaving(true);
    try {
      let screenshotUrl: string | undefined;
      if (draft.screenshotBlob) {
        const userId = await getCurrentUserIdForUpload();
        screenshotUrl = await uploadFeedbackScreenshot(
          userId,
          draft.screenshotBlob,
        );
      }

      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind,
          title: message.slice(0, 200),
          body:
            (draft.body ?? "").trim() ||
            (message.length > 200 ? message : undefined),
          screenshotUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      toast.success("Thanks — we got your feedback");
      resetDraft();
      setMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Feedback"
            className="text-neutral-400"
          />
        }
      >
        <LifebuoyIcon />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 gap-2 p-2"
        data-feedback-ui=""
      >
        <Textarea
          value={draft.title ?? ""}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder={
            draft.kind === "feature"
              ? "What should we add?"
              : "What went wrong?"
          }
          rows={4}
          maxLength={2000}
          disabled={saving}
          className="min-h-24 resize-none"
          autoFocus
        />
        {draft.screenshotPreviewUrl ? (
          <div className="relative overflow-hidden rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.screenshotPreviewUrl}
              alt="Feedback screenshot preview"
              className="max-h-28 w-full object-contain bg-muted/30"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="absolute top-1.5 right-1.5"
              aria-label="Remove screenshot"
              onClick={() => {
                if (draft.screenshotPreviewUrl?.startsWith("blob:")) {
                  URL.revokeObjectURL(draft.screenshotPreviewUrl);
                }
                setDraft({
                  ...draft,
                  screenshotBlob: null,
                  screenshotPreviewUrl: null,
                });
              }}
              disabled={saving}
            >
              <XIcon />
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Select
            value={draft.kind}
            onValueChange={(value) => {
              if (value === "bug" || value === "feature") {
                setDraft({ ...draft, kind: value });
              }
            }}
            disabled={saving}
          >
            <SelectTrigger size="sm" className="h-7 min-w-24 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-feedback-ui="">
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Pinpoint on screen"
            onClick={() => startPinMode()}
            disabled={saving}
          >
            <CrosshairIcon />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Sending…" : "Send"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
