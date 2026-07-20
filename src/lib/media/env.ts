/** True when ElevenLabs TTS credentials are configured. */
export function hasElevenLabs(): boolean {
  return Boolean(
    process.env.ELEVENLABS_API_KEY?.trim() &&
      process.env.ELEVENLABS_VOICE_ID?.trim(),
  );
}

/** True when Runway API secret is configured. */
export function hasRunway(): boolean {
  return Boolean(process.env.RUNWAYML_API_SECRET?.trim());
}

export function assertElevenLabsConfigured(): void {
  if (hasElevenLabs()) return;
  throw new Error(
    "ElevenLabs is not configured for video generation. " +
      "Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in this environment " +
      "(and in Trigger.dev → Environment Variables), then retry.",
  );
}

export function assertRunwayConfigured(): void {
  if (hasRunway()) return;
  throw new Error(
    "Runway is not configured for video generation. " +
      "Set RUNWAYML_API_SECRET in this environment " +
      "(and in Trigger.dev → Environment Variables), then retry.",
  );
}

export function getElevenLabsVoiceId(kind: "voiceover" | "dialogue"): string {
  assertElevenLabsConfigured();
  const vo = process.env.ELEVENLABS_VOICE_ID!.trim();
  if (kind === "dialogue") {
    return process.env.ELEVENLABS_DIALOGUE_VOICE_ID?.trim() || vo;
  }
  return vo;
}
