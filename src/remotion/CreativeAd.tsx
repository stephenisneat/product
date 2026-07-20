import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { CreativeAdProps } from "@/remotion/constants";
import {
  CREATIVE_AD_END_CARD_SEC,
  CREATIVE_AD_FPS,
  clipStartFrame,
} from "@/remotion/constants";

function Caption({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 32,
        right: 32,
        bottom: 72,
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-block",
          maxWidth: "100%",
          padding: "10px 16px",
          borderRadius: 8,
          backgroundColor: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.3,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {text}
      </span>
    </div>
  );
}

function EndCard({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          color: "#f5f5f5",
          fontSize: 42,
          fontWeight: 700,
          textAlign: "center",
          padding: "0 48px",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          letterSpacing: "-0.02em",
        }}
      >
        {title || "Get yours"}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Shared Remotion composition: sequences Veo clips, muxes ElevenLabs audio,
 * burns captions, and ends on a product title card.
 */
export const CreativeAd: React.FC<CreativeAdProps> = ({
  clips,
  productTitle,
  endCardSec = CREATIVE_AD_END_CARD_SEC,
}) => {
  const endCardFrom = clipStartFrame(clips, clips.length);
  const endCardFrames = Math.round(endCardSec * CREATIVE_AD_FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {clips.map((clip, index) => {
        const from = clipStartFrame(clips, index);
        const durationInFrames = Math.max(
          1,
          Math.round(clip.durationSec * CREATIVE_AD_FPS),
        );
        return (
          <Sequence
            key={clip.sceneId}
            from={from}
            durationInFrames={durationInFrames}
            name={clip.sceneId}
          >
            <AbsoluteFill>
              <Video
                src={clip.videoUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {clip.audioUrl ? <Audio src={clip.audioUrl} /> : null}
              <Caption text={clip.caption} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Sequence from={endCardFrom} durationInFrames={endCardFrames} name="end-card">
        <EndCard title={productTitle} />
      </Sequence>
    </AbsoluteFill>
  );
};
