import { describe, expect, it } from "vitest";
import {
  buildStubVideo,
  buildTemplateScreenplay,
  buildTemplateStoryboard,
  nextStageAfterAccept,
} from "@/lib/jobs/creative-stubs";

describe("creative stubs", () => {
  it("builds a screenplay with scenes from a brief", () => {
    const screenplay = buildTemplateScreenplay(
      "A sunny day hike with trail snacks",
      "Trail Mix Pro",
    );
    expect(screenplay.scenes.length).toBeGreaterThan(0);
    expect(screenplay.logline).toContain("sunny");
    expect(screenplay.script.length).toBeGreaterThan(20);
    expect(screenplay.scenes.some((s) => s.spokenKind === "dialogue")).toBe(
      true,
    );
    expect(screenplay.scenes.some((s) => s.spokenKind === "voiceover")).toBe(
      true,
    );
    expect(
      screenplay.scenes.every(
        (s) =>
          !/everyday friction|highlight the key benefit|show the/i.test(
            s.action,
          ),
      ),
    ).toBe(true);
  });

  it("builds storyboard frames from screenplay scenes", () => {
    const screenplay = buildTemplateScreenplay("Quick demo", "Widget");
    const storyboard = buildTemplateStoryboard(screenplay);
    expect(storyboard.frames).toHaveLength(screenplay.scenes.length);
    expect(storyboard.frames[0]?.imageUrl).toMatch(/^https:\/\//);
  });

  it("builds a stub video payload", () => {
    const screenplay = buildTemplateScreenplay("Idea", "Product");
    const video = buildStubVideo(screenplay);
    expect(video.url).toMatch(/^https:\/\//);
    expect(video.durationSec).toBe(screenplay.targetDurationSec);
  });

  it("advances stages until video is accepted", () => {
    expect(nextStageAfterAccept("screenplay")).toBe("storyboard");
    expect(nextStageAfterAccept("storyboard")).toBe("video");
    expect(nextStageAfterAccept("video")).toBeNull();
  });

  it("advances display stages until assets are accepted", () => {
    expect(nextStageAfterAccept("concept")).toBe("assets");
    expect(nextStageAfterAccept("assets")).toBeNull();
  });
});
