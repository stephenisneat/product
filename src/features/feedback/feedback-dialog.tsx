"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUserIdForUpload } from "@/features/feedback/get-upload-user-id";
import type { FeedbackDraft } from "@/features/feedback/feedback-context";
import { uploadFeedbackScreenshot } from "@/features/feedback/upload-feedback-screenshot";
import { XIcon } from "@/components/icons";

export function FeedbackDialog({
  open,
  draft,
  onDraftChange,
  onOpenChange,
  onStartPin,
}: {
  open: boolean;
  draft: FeedbackDraft;
  onDraftChange: (draft: FeedbackDraft) => void;
  onOpenChange: (open: boolean) => void;
  onStartPin: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function submit() {
    const title = (draft.title ?? "").trim();
    if (!title) {
      toast.error("Add a short summary");
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
          title,
          body: (draft.body ?? "").trim() || undefined,
          screenshotUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      toast.success("Thanks — we got your feedback");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-feedback-ui="">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Report a bug or suggest a feature. Optional screenshots help us
            find the issue faster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="feedback-kind">Type</Label>
            <Select
              value={draft.kind}
              onValueChange={(value) => {
                if (value === "bug" || value === "feature") {
                  onDraftChange({ ...draft, kind: value });
                }
              }}
            >
              <SelectTrigger id="feedback-kind" className="w-full">
                <SelectValue
                  placeholder={
                    draft.kind === "feature" ? "Feature request" : "Bug"
                  }
                />
              </SelectTrigger>
              <SelectContent data-feedback-ui="">
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature request</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-title">Summary</Label>
            <Input
              id="feedback-title"
              value={draft.title ?? ""}
              onChange={(e) =>
                onDraftChange({ ...draft, title: e.target.value })
              }
              placeholder={
                draft.kind === "bug"
                  ? "What went wrong?"
                  : "What should we add?"
              }
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-body">Details (optional)</Label>
            <Textarea
              id="feedback-body"
              value={draft.body ?? ""}
              onChange={(e) =>
                onDraftChange({ ...draft, body: e.target.value })
              }
              placeholder="Steps to reproduce, expected behavior, or why it matters…"
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Screenshot</Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onStartPin}
                disabled={saving}
              >
                {draft.screenshotPreviewUrl
                  ? "Retake pinpoint"
                  : "Pinpoint on screen"}
              </Button>
            </div>
            {draft.screenshotPreviewUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.screenshotPreviewUrl}
                  alt="Feedback screenshot preview"
                  className="max-h-48 w-full object-contain bg-muted/30"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute top-2 right-2"
                  aria-label="Remove screenshot"
                  onClick={() => {
                    if (draft.screenshotPreviewUrl?.startsWith("blob:")) {
                      URL.revokeObjectURL(draft.screenshotPreviewUrl);
                    }
                    onDraftChange({
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
            ) : (
              <p className="text-xs text-muted-foreground">
                Right-click anywhere and choose “Give feedback here”, or use
                Pinpoint above.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
