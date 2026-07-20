import { describe, expect, it } from "vitest";
import { clampVeoDuration } from "@/lib/media/runway";
import {
  CREATIVE_AD_END_CARD_SEC,
  CREATIVE_AD_FPS,
  clipStartFrame,
  creativeAdDurationInFrames,
  type CreativeAdClip,
} from "@/remotion/constants";

describe("clampVeoDuration", () => {
  it("maps scene lengths to nearest Veo-allowed duration", () => {
    expect(clampVeoDuration(3)).toBe(4);
    expect(clampVeoDuration(4)).toBe(4);
    expect(clampVeoDuration(5)).toBe(4);
    expect(clampVeoDuration(5.5)).toBe(6);
    expect(clampVeoDuration(7)).toBe(6);
    expect(clampVeoDuration(8)).toBe(8);
    expect(clampVeoDuration(12)).toBe(8);
  });
});

describe("creative ad timing", () => {
  const clips: CreativeAdClip[] = [
    {
      sceneId: "a",
      videoUrl: "https://example.com/a.mp4",
      audioUrl: null,
      durationSec: 4,
      caption: "",
    },
    {
      sceneId: "b",
      videoUrl: "https://example.com/b.mp4",
      audioUrl: null,
      durationSec: 6,
      caption: "Hi",
    },
  ];

  it("computes sequence start frames", () => {
    expect(clipStartFrame(clips, 0)).toBe(0);
    expect(clipStartFrame(clips, 1)).toBe(4 * CREATIVE_AD_FPS);
  });

  it("includes end card in total duration", () => {
    const frames = creativeAdDurationInFrames({
      clips,
      productTitle: "Widget",
    });
    expect(frames).toBe(
      Math.round((4 + 6 + CREATIVE_AD_END_CARD_SEC) * CREATIVE_AD_FPS),
    );
  });
});
