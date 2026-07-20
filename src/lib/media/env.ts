/** True when ElevenLabs API key is configured (voices are fetched / auto-cast). */
export function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

/** True when Runway API secret is configured. */
export function hasRunway(): boolean {
  return Boolean(process.env.RUNWAYML_API_SECRET?.trim());
}

export function assertElevenLabsConfigured(): void {
  if (hasElevenLabs()) return;
  throw new Error(
    "ElevenLabs is not configured for video generation. " +
      "Set ELEVENLABS_API_KEY in this environment " +
      "(and in Trigger.dev → Environment Variables), then retry. " +
      "Optional: ELEVENLABS_VOICE_ID / ELEVENLABS_DIALOGUE_VOICE_ID to pin overrides.",
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

/** Optional pinned narrator / voiceover voice. */
export function getElevenLabsVoiceoverOverride(): string | null {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || null;
}

/** Optional pinned default for the first dialogue character. */
export function getElevenLabsDialogueOverride(): string | null {
  return process.env.ELEVENLABS_DIALOGUE_VOICE_ID?.trim() || null;
}
