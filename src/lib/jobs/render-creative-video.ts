import path from "node:path";
import { promises as fs } from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import type { CreativeAdProps } from "@/remotion/constants";
import { CREATIVE_AD_ID } from "@/remotion/constants";
import {
  uploadCreativeFinalVideo,
  uploadCreativeThumbnail,
} from "@/lib/media/creative-assets";

/**
 * Bundle + render the CreativeAd composition, then upload MP4 + PNG thumb.
 */
export async function renderCreativeAdVideo(opts: {
  workspaceId: string;
  creativeId: string;
  props: CreativeAdProps;
}): Promise<{ videoUrl: string; thumbnailUrl: string; durationSec: number }> {
  await ensureBrowser();

  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  const serveUrl = await bundle({
    entryPoint,
    // Remotion resolves @/ via webpack aliases if configured; fall back to relative imports in remotion package.
    webpackOverride: (config) => {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@": path.join(process.cwd(), "src"),
      };
      return config;
    },
  });

  const composition = await selectComposition({
    serveUrl,
    id: CREATIVE_AD_ID,
    inputProps: opts.props,
  });

  const outDir = await fs.mkdtemp(path.join("/tmp", "creative-ad-"));
  const videoPath = path.join(outDir, "final.mp4");
  const thumbPath = path.join(outDir, "thumb.png");

  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: videoPath,
      inputProps: opts.props,
    });

    await renderStill({
      composition,
      serveUrl,
      output: thumbPath,
      inputProps: opts.props,
      frame: 0,
      imageFormat: "png",
    });

    const [videoBytes, thumbBytes] = await Promise.all([
      fs.readFile(videoPath),
      fs.readFile(thumbPath),
    ]);

    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadCreativeFinalVideo({
        workspaceId: opts.workspaceId,
        creativeId: opts.creativeId,
        bytes: new Uint8Array(videoBytes),
      }),
      uploadCreativeThumbnail({
        workspaceId: opts.workspaceId,
        creativeId: opts.creativeId,
        bytes: new Uint8Array(thumbBytes),
        contentType: "image/png",
      }),
    ]);

    const durationSec = composition.durationInFrames / composition.fps;

    return { videoUrl, thumbnailUrl, durationSec };
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
