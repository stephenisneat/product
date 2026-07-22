import { describe, expect, it } from "vitest";
import type { Product } from "@/domain";
import {
  charactersForScene,
  worldReferenceUrlsForScene,
} from "@/lib/jobs/generate-creative-content";
import {
  buildTemplateScreenplay,
  buildTemplateWorld,
} from "@/lib/jobs/creative-stubs";
import { creativeVoiceCastFromWorld } from "@/lib/media/voice-cast";

describe("world reference helpers", () => {
  it("reattaches style, location, cast, and product locks for a scene", () => {
    const screenplay = buildTemplateScreenplay("Demo", "Widget");
    const world = buildTemplateWorld(screenplay, "Widget");
    const scene = screenplay.scenes.find((s) => s.id === "scene-2")!;
    const characterNames = charactersForScene(scene, world);
    expect(characterNames).toContain("MAYA");

    const product = {
      images: ["https://cdn.example.com/product.jpg"],
      title: "Widget",
    } as Product;

    const refs = worldReferenceUrlsForScene({
      world,
      product,
      sceneId: scene.id,
      characterNames,
    });

    const locationId = world.sceneLocationIds[scene.id]!;
    const location = world.locations.find((l) => l.id === locationId)!;

    expect(refs).toContain(world.styleLockUrl);
    expect(refs).toContain(location.sheetUrl);
    expect(refs).toContain(world.characters[0]!.sheetUrl);
    expect(refs).toContain(world.productLockUrls[0]);
    expect(refs).toContain("https://cdn.example.com/product.jpg");
  });

  it("maps persisted world voice cast for video TTS", () => {
    const cast = creativeVoiceCastFromWorld({
      voiceoverId: "vo-1",
      characterVoices: { maya: "char-1" },
    });
    expect(cast.voiceoverId).toBe("vo-1");
    expect(cast.characterVoices.get("MAYA")).toBe("char-1");
  });
});
