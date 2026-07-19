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
});
