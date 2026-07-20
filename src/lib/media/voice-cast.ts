import type { ScreenplayScene } from "@/domain";

export type CastableVoice = {
  voiceId: string;
  name?: string;
  description?: string;
  labels?: Record<string, string>;
};

export type CreativeVoiceCast = {
  voiceoverId: string;
  /** UPPERCASE character name → voice ID */
  characterVoices: Map<string, string>;
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

export function buildVoiceCast(opts: {
  voices: CastableVoice[];
  scenes: ScreenplayScene[];
  creativeId: string;
  voiceoverOverride?: string | null;
  dialogueOverride?: string | null;
}): CreativeVoiceCast {
  const voiceoverId = pickNarratorVoiceId(
    opts.voices,
    opts.creativeId,
    opts.voiceoverOverride,
  );
  const characters = uniqueDialogueCharacters(opts.scenes);
  const characterVoices = assignCharacterVoiceIds({
    characters,
    voices: opts.voices,
    narratorId: voiceoverId,
    creativeId: opts.creativeId,
    firstCharacterOverride: opts.dialogueOverride,
  });
  return { voiceoverId, characterVoices };
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
