export const CREATIVE_AD_FPS = 30;
export const CREATIVE_AD_WIDTH = 1280;
export const CREATIVE_AD_HEIGHT = 720;
export const CREATIVE_AD_ID = "CreativeAd";
/** Hold on product end card after the last clip. */
export const CREATIVE_AD_END_CARD_SEC = 2;

export type CreativeAdClip = {
  sceneId: string;
  videoUrl: string;
  audioUrl: string | null;
  durationSec: number;
  caption: string;
};

export type CreativeAdProps = {
  clips: CreativeAdClip[];
  productTitle: string;
  endCardSec?: number;
};

export function creativeAdDurationInFrames(props: CreativeAdProps): number {
  const endCardSec = props.endCardSec ?? CREATIVE_AD_END_CARD_SEC;
  const clipsSec = props.clips.reduce((sum, c) => sum + c.durationSec, 0);
  return Math.max(
    1,
    Math.round((clipsSec + endCardSec) * CREATIVE_AD_FPS),
  );
}

export function clipStartFrame(
  clips: CreativeAdClip[],
  index: number,
): number {
  let frames = 0;
  for (let i = 0; i < index; i++) {
    frames += Math.round(clips[i]!.durationSec * CREATIVE_AD_FPS);
  }
  return frames;
}
