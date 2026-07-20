"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCroppedAvatarFile } from "@/lib/avatars/crop";
import { cn } from "@/lib/utils";

function AvatarCropSession({
  imageSrc,
  shape,
  onCropped,
  onCancel,
}: {
  imageSrc: string;
  shape: "round" | "rect";
  onCropped: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function applyCrop() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const file = await getCroppedAvatarFile(imageSrc, croppedAreaPixels);
      await onCropped(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to crop image");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={shape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="avatar-crop-zoom"
            className="text-xs font-medium text-muted-foreground"
          >
            Zoom
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={busy}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={cn(
              "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground",
            )}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={busy || !croppedAreaPixels}
          onClick={() => void applyCrop()}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AvatarCropDialog({
  open,
  imageSrc,
  title = "Crop avatar",
  description = "Drag to reposition. Use the slider to zoom.",
  shape = "round",
  onOpenChange,
  onCropped,
}: {
  open: boolean;
  imageSrc: string | null;
  title?: string;
  description?: string;
  shape?: "round" | "rect";
  onOpenChange: (open: boolean) => void;
  onCropped: (file: File) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {imageSrc ? (
          <AvatarCropSession
            key={imageSrc}
            imageSrc={imageSrc}
            shape={shape}
            onCancel={() => onOpenChange(false)}
            onCropped={async (file) => {
              await onCropped(file);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
