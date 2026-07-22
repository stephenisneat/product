import type { ScreenplayScene } from "@/domain";

export type CastableVoice = {
  voiceId: string;
  name?: string;
  description?: string;
  labels?: Record<string, string>;
};

export type CreativeVoiceCast = {
  voiceoverId: string;
  voiceoverName?: string;
  /** UPPERCASE character name → voice ID */
  characterVoices: Map<string, string>;
  /** UPPERCASE character name → display name */
  characterVoiceNames?: Map<string, string>;
};

export type CharacterVoiceProfile = {
  name: string;
  ageRange?: string;
  presentation?: string;
  appearanceSummary?: string;
};

/** Stable non-crypto hash for deterministic casting offsets. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function voiceBlob(voice: CastableVoice): string {
  return [
    voice.name ?? "",
    voice.description ?? "",
    voice.labels ? Object.values(voice.labels).join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();
}

function looksLikeNarrator(voice: CastableVoice): boolean {
  return /narrat|voice.?over|storytell|neutral|calm|professional|documentary|anchor/.test(
    voiceBlob(voice),
  );
}

function voiceName(voice: CastableVoice): string {
  return voice.name?.trim() || voice.voiceId;
}

/**
 * Prefer narration-ish voices for VO; otherwise rotate through the full pool
 * by creative id so ads don't all share the same narrator.
 */
export function pickNarratorVoiceId(
  voices: CastableVoice[],
  creativeId: string,
  override?: string | null,
): string {
  if (override?.trim()) return override.trim();
  if (voices.length === 0) {
    throw new Error("No ElevenLabs voices available to cast a narrator.");
  }
  const narrators = voices.filter(looksLikeNarrator);
  const pool = narrators.length > 0 ? narrators : voices;
  return pool[hashString(`vo:${creativeId}`) % pool.length]!.voiceId;
}

export function pickNarratorVoice(
  voices: CastableVoice[],
  creativeId: string,
  styleHints?: string | null,
  override?: string | null,
): CastableVoice {
  if (override?.trim()) {
    const found = voices.find((v) => v.voiceId === override.trim());
    if (found) return found;
  }
  if (voices.length === 0) {
    throw new Error("No ElevenLabs voices available to cast a narrator.");
  }

  const narrators = voices.filter(looksLikeNarrator);
  const pool = narrators.length > 0 ? narrators : voices;
  const hints = (styleHints ?? "").toLowerCase();
  if (hints) {
    const scored = pool
      .map((voice) => ({
        voice,
        score: scoreVoiceAgainstText(voice, hints),
      }))
      .sort((a, b) => b.score - a.score || a.voice.voiceId.localeCompare(b.voice.voiceId));
    if (scored[0] && scored[0].score > 0) return scored[0].voice;
  }
  return pool[hashString(`vo:${creativeId}`) % pool.length]!;
}

export function uniqueDialogueCharacters(
  scenes: ScreenplayScene[],
): string[] {
  const names = new Set<string>();
  for (const scene of scenes) {
    if (scene.spokenKind !== "dialogue") continue;
    const name = scene.character.trim().toUpperCase();
    if (name) names.add(name);
  }
  return [...names].sort();
}

function scoreVoiceAgainstText(voice: CastableVoice, text: string): number {
  const blob = voiceBlob(voice);
  if (!text.trim()) return 0;
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  let score = 0;
  for (const token of tokens) {
    if (blob.includes(token)) score += 2;
  }
  // Soft gender / age cues commonly present in ElevenLabs labels.
  if (/woman|female|feminine|girl/.test(text) && /female|woman|girl/.test(blob)) {
    score += 5;
  }
  if (/man|male|masculine|boy/.test(text) && /male|man|boy/.test(blob)) {
    score += 5;
  }
  if (/young|teen|20s|30s/.test(text) && /young|youth|bright/.test(blob)) {
    score += 2;
  }
  if (/older|senior|50s|60s/.test(text) && /mature|older|deep/.test(blob)) {
    score += 2;
  }
  if (/warm|friendly|casual/.test(text) && /warm|friendly|casual|conversational/.test(blob)) {
    score += 2;
  }
  if (/documentary|calm|professional|neutral/.test(text) && looksLikeNarrator(voice)) {
    score += 3;
  }
  return score;
}

/**
 * Assign a distinct voice per character name for this creative.
 * Offset rotates with creativeId so casts vary across ads.
 */
export function assignCharacterVoiceIds(opts: {
  characters: string[];
  voices: CastableVoice[];
  narratorId: string;
  creativeId: string;
  /** Pins the first (alphabetically) character when set. */
  firstCharacterOverride?: string | null;
}): Map<string, string> {
  const map = new Map<string, string>();
  if (opts.characters.length === 0) return map;
  if (opts.voices.length === 0) {
    throw new Error("No ElevenLabs voices available to cast characters.");
  }

  let pool = opts.voices.filter((v) => v.voiceId !== opts.narratorId);
  if (pool.length === 0) pool = [...opts.voices];

  const offset = hashString(`cast:${opts.creativeId}`) % pool.length;
  const override = opts.firstCharacterOverride?.trim() || null;

  opts.characters.forEach((character, index) => {
    if (index === 0 && override) {
      map.set(character, override);
      return;
    }
    // Skip the override voice in the rotating pool when possible.
    let pickIndex = (offset + index) % pool.length;
    if (override && pool.length > 1) {
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const candidate = pool[(offset + index + attempt) % pool.length]!;
        if (candidate.voiceId !== override) {
          pickIndex = (offset + index + attempt) % pool.length;
          break;
        }
      }
    }
    map.set(character, pool[pickIndex]!.voiceId);
  });

  return map;
}

/**
 * Score-aware casting: match character appearance/presentation to voice labels,
 * keep voices distinct, fall back to hash rotation.
 */
export function assignCharacterVoicesFromProfiles(opts: {
  profiles: CharacterVoiceProfile[];
  voices: CastableVoice[];
  narratorId: string;
  creativeId: string;
  firstCharacterOverride?: string | null;
}): Map<string, CastableVoice> {
  const result = new Map<string, CastableVoice>();
  if (opts.profiles.length === 0) return result;
  if (opts.voices.length === 0) {
    throw new Error("No ElevenLabs voices available to cast characters.");
  }

  let pool = opts.voices.filter((v) => v.voiceId !== opts.narratorId);
  if (pool.length === 0) pool = [...opts.voices];

  const used = new Set<string>();
  const override = opts.firstCharacterOverride?.trim() || null;
  const sorted = [...opts.profiles].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  sorted.forEach((profile, index) => {
    const key = profile.name.trim().toUpperCase();
    if (!key) return;

    if (index === 0 && override) {
      const pinned =
        opts.voices.find((v) => v.voiceId === override) ?? pool[0]!;
      result.set(key, pinned);
      used.add(pinned.voiceId);
      return;
    }

    const query = [
      profile.presentation,
      profile.ageRange,
      profile.appearanceSummary,
      profile.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const available = pool.filter((v) => !used.has(v.voiceId));
    const candidates = available.length > 0 ? available : pool;
    const scored = candidates
      .map((voice) => ({
        voice,
        score: scoreVoiceAgainstText(voice, query),
      }))
      .sort((a, b) => b.score - a.score || a.voice.voiceId.localeCompare(b.voice.voiceId));

    const best =
      scored[0] && scored[0].score > 0
        ? scored[0].voice
        : candidates[
            hashString(`cast:${opts.creativeId}:${key}`) % candidates.length
          ]!;

    result.set(key, best);
    used.add(best.voiceId);
  });

  return result;
}

export function buildVoiceCast(opts: {
  voices: CastableVoice[];
  scenes: ScreenplayScene[];
  creativeId: string;
  voiceoverOverride?: string | null;
  dialogueOverride?: string | null;
}): CreativeVoiceCast {
  const narrator = pickNarratorVoice(
    opts.voices,
    opts.creativeId,
    null,
    opts.voiceoverOverride,
  );
  const characters = uniqueDialogueCharacters(opts.scenes);
  const characterVoices = assignCharacterVoiceIds({
    characters,
    voices: opts.voices,
    narratorId: narrator.voiceId,
    creativeId: opts.creativeId,
    firstCharacterOverride: opts.dialogueOverride,
  });
  const characterVoiceNames = new Map<string, string>();
  for (const [name, voiceId] of characterVoices) {
    const voice = opts.voices.find((v) => v.voiceId === voiceId);
    characterVoiceNames.set(name, voice ? voiceName(voice) : voiceId);
  }
  return {
    voiceoverId: narrator.voiceId,
    voiceoverName: voiceName(narrator),
    characterVoices,
    characterVoiceNames,
  };
}

export function buildVoiceCastFromProfiles(opts: {
  voices: CastableVoice[];
  profiles: CharacterVoiceProfile[];
  creativeId: string;
  styleHints?: string | null;
  voiceoverOverride?: string | null;
  dialogueOverride?: string | null;
}): CreativeVoiceCast {
  const narrator = pickNarratorVoice(
    opts.voices,
    opts.creativeId,
    opts.styleHints,
    opts.voiceoverOverride,
  );
  const assigned = assignCharacterVoicesFromProfiles({
    profiles: opts.profiles,
    voices: opts.voices,
    narratorId: narrator.voiceId,
    creativeId: opts.creativeId,
    firstCharacterOverride: opts.dialogueOverride,
  });
  const characterVoices = new Map<string, string>();
  const characterVoiceNames = new Map<string, string>();
  for (const [name, voice] of assigned) {
    characterVoices.set(name, voice.voiceId);
    characterVoiceNames.set(name, voiceName(voice));
  }
  return {
    voiceoverId: narrator.voiceId,
    voiceoverName: voiceName(narrator),
    characterVoices,
    characterVoiceNames,
  };
}

export function resolveSceneVoiceId(
  cast: CreativeVoiceCast,
  scene: Pick<ScreenplayScene, "spokenKind" | "character">,
): string {
  if (scene.spokenKind === "dialogue") {
    const key = scene.character.trim().toUpperCase();
    if (key && cast.characterVoices.has(key)) {
      return cast.characterVoices.get(key)!;
    }
  }
  return cast.voiceoverId;
}

/** Convert persisted world voiceCast JSON into the Map-based cast used by TTS. */
export function creativeVoiceCastFromWorld(opts: {
  voiceoverId: string;
  characterVoices: Record<string, string>;
}): CreativeVoiceCast {
  return {
    voiceoverId: opts.voiceoverId,
    characterVoices: new Map(
      Object.entries(opts.characterVoices).map(([k, v]) => [
        k.trim().toUpperCase(),
        v,
      ]),
    ),
  };
}
