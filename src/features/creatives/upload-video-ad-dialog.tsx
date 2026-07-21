"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ImagePlusIcon, Loader2, PlusIcon } from "@/components/icons";
import { toast } from "sonner";
import type { Creative, Product } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  CREATIVE_VIDEO_MAX_BYTES,
  CREATIVE_VIDEO_MAX_DURATION_SEC,
  extensionForCreativeVideo,
  validateCreativeVideoFile,
} from "@/lib/media/creative-upload-shared";
import { createClient } from "@/lib/supabase/client";

type VideoMeta = {
  durationSec: number;
  aspectRatio: string;
  thumbnailBlob: Blob;
  width: number;
  height: number;
};

function resolveVideoContentType(file: File): string {
  if (file.type && extensionForCreativeVideo(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  return file.type || "application/octet-stream";
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function aspectRatioLabel(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const ratio = w / h;
  const presets: [number, string][] = [
    [9 / 16, "9:16"],
    [16 / 9, "16:9"],
    [1, "1:1"],
    [4 / 5, "4:5"],
    [5 / 4, "5:4"],
  ];
  for (const [value, label] of presets) {
    if (Math.abs(ratio - value) < 0.06) return label;
  }
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    video.onerror = () => fail("Could not read this video file.");

    video.onloadeddata = () => {
      const durationSec = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        fail("Could not read video duration.");
        return;
      }
      if (!width || !height) {
        fail("Could not read video dimensions.");
        return;
      }

      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            fail("Could not capture a thumbnail.");
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (!blob) {
                reject(new Error("Could not capture a thumbnail."));
                return;
              }
              resolve({
                durationSec,
                aspectRatio: aspectRatioLabel(width, height),
                thumbnailBlob: blob,
                width,
                height,
              });
            },
            "image/jpeg",
            0.86,
          );
        } catch {
          fail("Could not capture a thumbnail.");
        }
      };

      // Seek slightly in for a more useful poster frame when possible.
      const seekTo = Math.min(0.25, Math.max(0, durationSec / 10));
      if (seekTo > 0.05) {
        video.onseeked = () => {
          video.onseeked = null;
          capture();
        };
        video.currentTime = seekTo;
      } else {
        capture();
      }
    };
  });
}

async function uploadToSignedTarget(
  path: string,
  token: string,
  body: Blob,
  contentType: string,
) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("workspace-assets")
    .uploadToSignedUrl(path, token, body, {
      contentType,
      cacheControl: "3600",
    });
  if (error) {
    throw new Error(error.message || "Upload failed");
  }
}

type PrepareResponse = {
  creativeId: string;
  video: { path: string; token: string; signedUrl: string };
  thumbnail: { path: string; token: string; signedUrl: string };
  error?: string;
};

type CompleteResponse = {
  creative?: Creative;
  error?: string;
  code?: string;
};

export function UploadVideoAdDialog({
  products,
  onUploaded,
}: {
  products: Pick<Product, "id" | "title">[];
  onUploaded?: (creative: Creative) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setFile(null);
    setMeta(null);
    setError(null);
    setReading(false);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (products[0]) setProductId(products[0].id);
  }

  async function onFileChange(next: File | null) {
    setError(null);
    setFile(next);
    setMeta(null);
    if (!next) return;

    const contentType = resolveVideoContentType(next);
    const fileError = validateCreativeVideoFile({
      contentType,
      sizeBytes: next.size,
    });
    if (fileError) {
      setError(fileError);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setReading(true);
    try {
      const nextMeta = await readVideoMeta(next);
      if (nextMeta.durationSec > CREATIVE_VIDEO_MAX_DURATION_SEC) {
        throw new Error(
          `Video must be ${CREATIVE_VIDEO_MAX_DURATION_SEC} seconds or shorter.`,
        );
      }
      setMeta(nextMeta);
      if (!title.trim()) {
        const base = next.name.replace(/\.[^.]+$/, "").trim();
        if (base) setTitle(base.slice(0, 120));
      }
    } catch (err) {
      setFile(null);
      setMeta(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(err instanceof Error ? err.message : "Could not read video.");
    } finally {
      setReading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError("Select a product.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!file || !meta) {
      setError("Choose a video file.");
      return;
    }

    setSubmitting(true);
    try {
      const contentType = resolveVideoContentType(file);
      const prepareRes = await fetch("/api/creatives/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          videoContentType: contentType,
          videoSizeBytes: file.size,
          thumbnailContentType: "image/jpeg",
        }),
      });
      const prepareBody = (await prepareRes.json()) as PrepareResponse;
      if (!prepareRes.ok) {
        throw new Error(prepareBody.error || "Could not start upload.");
      }

      await Promise.all([
        uploadToSignedTarget(
          prepareBody.video.path,
          prepareBody.video.token,
          file,
          contentType,
        ),
        uploadToSignedTarget(
          prepareBody.thumbnail.path,
          prepareBody.thumbnail.token,
          meta.thumbnailBlob,
          "image/jpeg",
        ),
      ]);

      const completeRes = await fetch("/api/creatives/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          creativeId: prepareBody.creativeId,
          productId,
          title: title.trim(),
          videoPath: prepareBody.video.path,
          thumbnailPath: prepareBody.thumbnail.path,
          durationSec: Number(meta.durationSec.toFixed(2)),
          aspectRatio: meta.aspectRatio,
        }),
      });
      const completeBody = (await completeRes.json()) as CompleteResponse;
      if (!completeRes.ok || !completeBody.creative) {
        throw new Error(completeBody.error || "Could not save video ad.");
      }

      toast.success("Video ad uploaded");
      onUploaded?.(completeBody.creative);
      setOpen(false);
      resetForm();
      router.refresh();
      router.push(`/creatives/${completeBody.creative.id}?tab=video`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not upload video ad.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = products.length === 0;
  const busy = reading || submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={disabled} />
        }
      >
        <PlusIcon data-icon="inline-start" className="size-3.5" />
        Upload video
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Upload video ad</DialogTitle>
            <DialogDescription>
              Add your own MP4, WebM, or MOV. Max{" "}
              {Math.round(CREATIVE_VIDEO_MAX_BYTES / (1024 * 1024))} MB and{" "}
              {CREATIVE_VIDEO_MAX_DURATION_SEC}s.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create a product first, then upload a video ad for it.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${titleId}-product`}>Product</Label>
                  <Select
                    value={productId}
                    onValueChange={(value) => {
                      if (value) setProductId(value);
                    }}
                  >
                    <SelectTrigger id={`${titleId}-product`} className="w-full">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${titleId}-title`}>Title</Label>
                  <Input
                    id={`${titleId}-title`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Summer launch cut"
                    maxLength={120}
                    disabled={busy}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${titleId}-file`}>Video file</Label>
                  <input
                    ref={fileInputRef}
                    id={`${titleId}-file`}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      void onFileChange(e.target.files?.[0] ?? null);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/30 disabled:opacity-50"
                  >
                    {reading ? (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ImagePlusIcon className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {file ? file.name : "Choose video"}
                    </span>
                    {meta ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {meta.durationSec.toFixed(1)}s · {meta.aspectRatio} ·{" "}
                        {meta.width}×{meta.height}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        MP4, WebM, or MOV
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}

            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || disabled || !file || !meta || !title.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
