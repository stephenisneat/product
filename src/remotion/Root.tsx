import React from "react";
import { Composition } from "remotion";
import { CreativeAd } from "@/remotion/CreativeAd";
import {
  CREATIVE_AD_FPS,
  CREATIVE_AD_HEIGHT,
  CREATIVE_AD_ID,
  CREATIVE_AD_WIDTH,
  creativeAdDurationInFrames,
  type CreativeAdProps,
} from "@/remotion/constants";

const defaultProps: CreativeAdProps = {
  clips: [],
  productTitle: "Product",
  endCardSec: 2,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={CREATIVE_AD_ID}
        component={CreativeAd}
        durationInFrames={creativeAdDurationInFrames(defaultProps)}
        fps={CREATIVE_AD_FPS}
        width={CREATIVE_AD_WIDTH}
        height={CREATIVE_AD_HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: creativeAdDurationInFrames(props),
        })}
      />
    </>
  );
};
