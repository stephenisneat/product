import { describe, expect, it } from "vitest";
import type { ScreenplayScene } from "@/domain";
import {
  assignCharacterVoiceIds,
  buildVoiceCast,
  hashString,
  pickNarratorVoiceId,
  resolveSceneVoiceId,
  uniqueDialogueCharacters,
  type CastableVoice,
} from "@/lib/media/voice-cast";

const voices: CastableVoice[] = [
  { voiceId: "narr-1", name: "Calm Narrator", labels: { use: "narration" } },
  { voiceId: "char-a", name: "Alex", labels: { gender: "female" } },
  { voiceId: "char-b", name: "Blake", labels: { gender: "male" } },
  { voiceId: "char-c", name: "Casey" },
];

function scene(
  partial: Partial<ScreenplayScene> & Pick<ScreenplayScene, "id">,
): ScreenplayScene {
  return {
    heading: "INT. ROOM",
    action: "Someone speaks.",
    dialogue: "Hello",
    spokenKind: "voiceover",
    character: "",
    durationSec: 3,
    ...partial,
  };
}

describe("voice cast", () => {
  it("hashes stably", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("honors narrator override and prefers narration-labeled voices", () => {
    expect(pickNarratorVoiceId(voices, "c1", "pinned-vo")).toBe("pinned-vo");
    expect(pickNarratorVoiceId(voices, "c1")).toBe("narr-1");
  });

  it("collects unique dialogue characters", () => {
    const chars = uniqueDialogueCharacters([
      scene({ id: "1", spokenKind: "dialogue", character: "Maya" }),
      scene({ id: "2", spokenKind: "voiceover", character: "" }),
      scene({ id: "3", spokenKind: "dialogue", character: "maya" }),
      scene({ id: "4", spokenKind: "dialogue", character: "Dad" }),
    ]);
    expect(chars).toEqual(["DAD", "MAYA"]);
  });

  it("assigns distinct character voices and varies by creative", () => {
    const castA = assignCharacterVoiceIds({
      characters: ["DAD", "MAYA"],
      voices,
      narratorId: "narr-1",
      creativeId: "creative-a",
    });
    const castB = assignCharacterVoiceIds({
      characters: ["DAD", "MAYA"],
      voices,
      narratorId: "narr-1",
      creativeId: "creative-b",
    });

    expect(castA.get("DAD")).toBeTruthy();
    expect(castA.get("MAYA")).toBeTruthy();
    expect(castA.get("DAD")).not.toBe(castA.get("MAYA"));
    expect(castA.get("DAD")).not.toBe("narr-1");

    // Different creatives should often get a rotated cast (not required identical
    // difference for every id pair, but these two diverge with our hash).
    expect(
      `${castA.get("DAD")}|${castA.get("MAYA")}`,
    ).not.toBe(`${castB.get("DAD")}|${castB.get("MAYA")}`);
  });

  it("pins first character via dialogue override", () => {
    const cast = assignCharacterVoiceIds({
      characters: ["DAD", "MAYA"],
      voices,
      narratorId: "narr-1",
      creativeId: "creative-a",
      firstCharacterOverride: "char-c",
    });
    expect(cast.get("DAD")).toBe("char-c");
    expect(cast.get("MAYA")).not.toBe("char-c");
  });

  it("resolves voiceover vs dialogue from cast", () => {
    const cast = buildVoiceCast({
      voices,
      scenes: [
        scene({ id: "1", spokenKind: "dialogue", character: "Maya" }),
        scene({ id: "2", spokenKind: "voiceover", dialogue: "VO line" }),
      ],
      creativeId: "creative-x",
    });

    expect(
      resolveSceneVoiceId(cast, { spokenKind: "voiceover", character: "" }),
    ).toBe(cast.voiceoverId);
    expect(
      resolveSceneVoiceId(cast, { spokenKind: "dialogue", character: "Maya" }),
    ).toBe(cast.characterVoices.get("MAYA"));
  });
});
