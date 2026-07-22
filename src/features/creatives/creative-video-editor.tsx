"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Player, type PlayerRef } from "@remotion/player";
import type { Creative, VideoClip } from "@/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreativeAd } from "@/remotion/CreativeAd";
import {
  CREATIVE_AD_END_CARD_SEC,
  CREATIVE_AD_FPS,
  CREATIVE_AD_HEIGHT,
  CREATIVE_AD_WIDTH,
  clipStartFrame,
  creativeAdDurationInFrames,
  type CreativeAdClip,
  type CreativeAdProps,
} from "@/remotion/constants";
import { cn } from "@/lib/utils";

function toRemotionClips(clips: VideoClip[]): CreativeAdClip[] {
  return clips.map((c) => ({
    sceneId: c.sceneId,
    videoUrl: c.url,
    audioUrl: c.audioUrl,
    durationSec: c.durationSec,
    caption: c.caption ?? "",
  }));
}

function toRemotionProps(
  creative: Creative,
  clips: VideoClip[],
): CreativeAdProps | null {
  const video = creative.video;
  if (!video || clips.length === 0) return null;
  return {
    clips: toRemotionClips(clips),
    productTitle: video.productTitle || creative.title,
    endCardSec: CREATIVE_AD_END_CARD_SEC,
  };
}

function activeClipIndex(clips: VideoClip[], frame: number): number {
  const remotionClips = toRemotionClips(clips);
  for (let i = 0; i < clips.length; i++) {
    const start = clipStartFrame(remotionClips, i);
    const end =
      start + Math.round(clips[i]!.durationSec * CREATIVE_AD_FPS);
    if (frame >= start && frame < end) return i;
  }
  return Math.max(0, clips.length - 1);
}

function normalizeClips(clips: VideoClip[]): VideoClip[] {
  return clips.map((c) => ({
    ...c,
    caption: c.caption ?? "",
    sourceDurationSec: c.sourceDurationSec ?? c.durationSec,
  }));
}

/** Remotion Player + editable clip timeline for a completed video payload. */
export function CreativeVideoEditor({ creative }: { creative: Creative }) {
  const router = useRouter();
  const video = creative.video!;
  const playerRef = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [clips, setClips] = useState(() => normalizeClips(video.clips ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClips(normalizeClips(creative.video?.clips ?? []));
  }, [creative.video]);

  const baseline = useMemo(
    () => JSON.stringify(normalizeClips(video.clips ?? [])),
    [video.clips],
  );
  const dirty = JSON.stringify(clips) !== baseline;
  const canEdit =
    clips.length > 0 &&
    creative.status !== "generating" &&
    creative.status !== "rejected";

  const remotionProps = useMemo(
    () => toRemotionProps(creative, clips),
    [creative, clips],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      setFrame(e.detail.frame);
    };
    player.addEventListener("frameupdate", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
    };
  }, [remotionProps]);

  const seekToClip = useCallback(
    (index: number) => {
      if (!remotionProps) return;
      const start = clipStartFrame(remotionProps.clips, index);
      playerRef.current?.seekTo(start);
      setFrame(start);
    },
    [remotionProps],
  );

  function updateClip(index: number, patch: Partial<VideoClip>) {
    setClips((prev) =>
      prev.map((clip, i) => {
        if (i !== index) return clip;
        const source = clip.sourceDurationSec ?? clip.durationSec;
        const next = { ...clip, ...patch, sourceDurationSec: source };
        if (patch.durationSec != null) {
          next.durationSec = Math.min(Math.max(0.5, patch.durationSec), source);
        }
        return next;
      }),
    );
  }

  function moveClip(index: number, direction: -1 | 1) {
    setClips((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  async function saveAndReexport() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_video_edits",
          clips,
          reexport: true,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to save edits.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits.");
    } finally {
      setSaving(false);
    }
  }

  // Legacy stub / uploaded payloads without clips: fall back to plain HTML video.
  if (!remotionProps) {
    const aspectCss = video.aspectRatio.includes(":")
      ? video.aspectRatio.replace(":", " / ")
      : "9 / 16";
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-10">
        <video
          className="max-h-[70vh] w-full rounded-lg bg-black object-contain"
          style={{ aspectRatio: aspectCss }}
          controls
          poster={video.thumbnailUrl}
          src={video.url}
        />
        <p className="font-mono text-xs text-muted-foreground">
          {video.durationSec}s · {video.aspectRatio}
        </p>
      </div>
    );
  }

  const durationInFrames = creativeAdDurationInFrames(remotionProps);
  const active = activeClipIndex(clips, frame);
  const totalSec = clips.reduce((s, c) => s + c.durationSec, 0);
  const activeClip = clips[active];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg bg-black shadow-sm ring-1 ring-border">
        <Player
          ref={playerRef}
          component={CreativeAd}
          inputProps={remotionProps}
          durationInFrames={durationInFrames}
          compositionWidth={CREATIVE_AD_WIDTH}
          compositionHeight={CREATIVE_AD_HEIGHT}
          fps={CREATIVE_AD_FPS}
          style={{ width: "100%", aspectRatio: "9 / 16" }}
          controls
          clickToPlay
          loop={false}
          acknowledgeRemotionLicense
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Timeline</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              {totalSec.toFixed(1)}s clips · {video.aspectRatio}
            </p>
            {canEdit ? (
              <Button
                size="sm"
                disabled={!dirty || saving}
                onClick={() => void saveAndReexport()}
              >
                {saving ? "Re-exporting…" : "Save & re-export"}
              </Button>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {clips.map((clip, index) => {
            const selected = index === active;
            return (
              <button
                key={`${clip.sceneId}-${index}`}
                type="button"
                onClick={() => seekToClip(index)}
                className={cn(
                  "group relative w-28 shrink-0 overflow-hidden rounded-md border text-left transition-colors",
                  selected
                    ? "border-foreground ring-1 ring-foreground"
                    : "border-border hover:border-foreground/40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clip.thumbnailUrl || video.thumbnailUrl}
                  alt=""
                  className="aspect-[9/16] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-6 pb-1.5">
                  <p className="truncate text-[10px] font-medium text-white">
                    {clip.sceneId}
                  </p>
                  <p className="font-mono text-[10px] text-white/80">
                    {clip.durationSec}s
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {canEdit && activeClip ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium">
                Edit clip {active + 1} ({activeClip.sceneId})
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={active === 0 || saving}
                onClick={() => moveClip(active, -1)}
              >
                Move left
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={active >= clips.length - 1 || saving}
                onClick={() => moveClip(active, 1)}
              >
                Move right
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`clip-duration-${active}`}>
                  Duration (sec, max{" "}
                  {(activeClip.sourceDurationSec ?? activeClip.durationSec).toFixed(
                    1,
                  )}
                  )
                </Label>
                <Input
                  id={`clip-duration-${active}`}
                  type="number"
                  min={0.5}
                  step={0.1}
                  max={activeClip.sourceDurationSec ?? activeClip.durationSec}
                  value={activeClip.durationSec}
                  disabled={saving}
                  onChange={(e) =>
                    updateClip(active, {
                      durationSec: Number(e.target.value) || 0.5,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`clip-caption-${active}`}>Caption</Label>
              <Textarea
                id={`clip-caption-${active}`}
                rows={2}
                value={activeClip.caption ?? ""}
                disabled={saving}
                onChange={(e) => updateClip(active, { caption: e.target.value })}
              />
            </div>
          </div>
        ) : activeClip?.caption ? (
          <p className="text-xs text-muted-foreground">
            Clip {active + 1}: “{activeClip.caption}”
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Final render:{" "}
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            download MP4
          </a>
        </p>
      </div>
    </div>
  );
}
