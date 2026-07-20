import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  assertElevenLabsConfigured,
  getElevenLabsVoiceId,
} from "@/lib/media/env";
import {
  readableStreamToUint8Array,
  uploadCreativeAudio,
} from "@/lib/media/creative-assets";

function getClient(): ElevenLabsClient {
  assertElevenLabsConfigured();
  return new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY!.trim(),
  });
}

/**
 * Synthesize spoken dialogue/voiceover and upload MP3 to workspace-assets.
 * Returns null when text is empty.
 */
export async function synthesizeSceneAudio(opts: {
  text: string;
  spokenKind: "voiceover" | "dialogue";
  workspaceId: string;
  creativeId: string;
  sceneId: string;
}): Promise<string | null> {
  const text = opts.text.trim();
  if (!text) return null;

  const client = getClient();
  const voiceId = getElevenLabsVoiceId(opts.spokenKind);
  const stream = await client.textToSpeech.convert(voiceId, {
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
