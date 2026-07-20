import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ScreenplayScene } from "@/domain";
import {
  assertElevenLabsConfigured,
  getElevenLabsDialogueOverride,
  getElevenLabsVoiceoverOverride,
} from "@/lib/media/env";
import {
  readableStreamToUint8Array,
  uploadCreativeAudio,
} from "@/lib/media/creative-assets";
import {
  buildVoiceCast,
  resolveSceneVoiceId,
  type CastableVoice,
  type CreativeVoiceCast,
} from "@/lib/media/voice-cast";

function getClient(): ElevenLabsClient {
  assertElevenLabsConfigured();
  return new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY!.trim(),
  });
}

/**
 * Load voices available to this ElevenLabs API key (account library).
 */
export async function listElevenLabsVoices(): Promise<CastableVoice[]> {
  const client = getClient();
  const response = await client.voices.getAll({ showLegacy: false });
  const voices = (response.voices ?? [])
    .filter((v) => Boolean(v.voiceId))
    .map((v) => ({
      voiceId: v.voiceId,
      name: v.name,
      description: v.description,
      labels: v.labels,
    }));

  if (voices.length === 0) {
    throw new Error(
      "ElevenLabs returned no voices for this API key. " +
        "Add voices in the ElevenLabs Voice Library, or set ELEVENLABS_VOICE_ID.",
    );
  }

  return voices;
}

/** Build a per-creative cast: one narrator + stable character → voice map. */
export async function createCreativeVoiceCast(opts: {
  creativeId: string;
  scenes: ScreenplayScene[];
}): Promise<CreativeVoiceCast> {
  const voices = await listElevenLabsVoices();
  return buildVoiceCast({
    voices,
    scenes: opts.scenes,
    creativeId: opts.creativeId,
    voiceoverOverride: getElevenLabsVoiceoverOverride(),
    dialogueOverride: getElevenLabsDialogueOverride(),
  });
}

/**
 * Synthesize spoken dialogue/voiceover and upload MP3 to workspace-assets.
 * Returns null when text is empty.
 */
export async function synthesizeSceneAudio(opts: {
  text: string;
  voiceId: string;
  workspaceId: string;
  creativeId: string;
  sceneId: string;
}): Promise<string | null> {
  const text = opts.text.trim();
  if (!text) return null;

  const client = getClient();
  const stream = await client.textToSpeech.convert(opts.voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  const bytes = await readableStreamToUint8Array(stream);
  if (bytes.byteLength === 0) {
    throw new Error(`ElevenLabs returned empty audio for scene ${opts.sceneId}.`);
  }

  return uploadCreativeAudio({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    sceneId: opts.sceneId,
    bytes,
  });
}

export { resolveSceneVoiceId };
export type { CreativeVoiceCast };
