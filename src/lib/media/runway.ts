import RunwayML from "@runwayml/sdk";
import { assertRunwayConfigured } from "@/lib/media/env";
import {
  downloadUrlToBytes,
  uploadCreativeVideoClip,
} from "@/lib/media/creative-assets";

/** Veo 3.1 only accepts these durations. */
export type VeoDuration = 4 | 6 | 8;

export function clampVeoDuration(seconds: number): VeoDuration {
  const allowed: VeoDuration[] = [4, 6, 8];
  let best: VeoDuration = 4;
  let bestDiff = Infinity;
  for (const d of allowed) {
    const diff = Math.abs(d - seconds);
    if (diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}

function getClient(): RunwayML {
  assertRunwayConfigured();
  return new RunwayML({
    apiKey: process.env.RUNWAYML_API_SECRET!.trim(),
  });
}

/**
 * Image-to-video via Veo 3.1. Audio is left off so ElevenLabs can be muxed in Remotion.
 * Downloads the signed Runway output and persists it to workspace-assets.
 */
export async function generateVeoClip(opts: {
  promptImageUrl: string;
  promptText: string;
  durationSec: number;
  workspaceId: string;
  creativeId: string;
  sceneId: string;
  abortSignal?: AbortSignal;
}): Promise<{ url: string; durationSec: VeoDuration }> {
  const client = getClient();
  const duration = clampVeoDuration(opts.durationSec);
  const promptText =
    opts.promptText.trim().slice(0, 1000) ||
    "Subtle camera motion, cinematic product ad, vertical framing.";

  const task = await client.imageToVideo
    .create({
      model: "veo3.1",
      promptImage: opts.promptImageUrl,
      promptText,
      ratio: "720:1280",
      duration,
      // Native Veo audio off — we mux ElevenLabs in Remotion.
      audio: false,
    })
    .waitForTaskOutput({
      timeout: 10 * 60 * 1000,
      abortSignal: opts.abortSignal,
    });

  const outputUrl = task.output[0];
  if (!outputUrl) {
    throw new Error(`Runway returned no video for scene ${opts.sceneId}.`);
  }

  const { bytes, contentType } = await downloadUrlToBytes(outputUrl);
  const url = await uploadCreativeVideoClip({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    sceneId: opts.sceneId,
    bytes,
    contentType: contentType || "video/mp4",
  });

  return { url, durationSec: duration };
}
