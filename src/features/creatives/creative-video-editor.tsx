"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { Creative, VideoClip } from "@/domain";
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

function toRemotionProps(creative: Creative): CreativeAdProps | null {
  const video = creative.video;
  if (!video?.clips?.length) return null;
  return {
    clips: toRemotionClips(video.clips),
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

/** Remotion Player + clip timeline for a completed video payload. */
export function CreativeVideoEditor({ creative }: { creative: Creative }) {
  const video = creative.video!;
  const playerRef = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);

  const remotionProps = useMemo(() => toRemotionProps(creative), [creative]);

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
  const clips = video.clips;
  const active = activeClipIndex(clips, frame);
  const totalSec = clips.reduce((s, c) => s + c.durationSec, 0);

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

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Timeline</p>
          <p className="font-mono text-xs text-muted-foreground">
            {totalSec}s clips · {video.durationSec.toFixed(1)}s final ·{" "}
            {video.aspectRatio}
          </p>
        </div>

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
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-6">
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

        {clips[active]?.caption ? (
          <p className="text-xs text-muted-foreground">
            Clip {active + 1}: “{clips[active]!.caption}”
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
