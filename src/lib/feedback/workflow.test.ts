import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  adminFeedbackStatusSchema,
  updateAdminFeedbackPromptSchema,
} from "@/domain";
import {
  buildFeedbackAgentBranchName,
  parsePrNumber,
  verifyCursorWebhookSignature,
} from "@/lib/cursor/cloud-agents";
import {
  generateFeedbackAgentPrompt,
  wrapPromptForCloudAgent,
} from "@/lib/feedback/generate-prompt";

describe("admin feedback workflow schemas", () => {
  it("accepts workflow statuses", () => {
    expect(adminFeedbackStatusSchema.parse("prompt_ready")).toBe(
      "prompt_ready",
    );
    expect(() => adminFeedbackStatusSchema.parse("nope")).toThrow();
  });

  it("validates prompt updates", () => {
    expect(
      updateAdminFeedbackPromptSchema.parse({ prompt: "Do the thing" }).prompt,
    ).toBe("Do the thing");
    expect(() =>
      updateAdminFeedbackPromptSchema.parse({ prompt: "  " }),
    ).toThrow();
  });
});

describe("cursor cloud agent helpers", () => {
  it("parses PR numbers from github urls", () => {
    expect(
      parsePrNumber("https://github.com/org/repo/pull/1234"),
    ).toBe(1234);
    expect(
      parsePrNumber("https://github.com/org/repo/pull/99/files"),
    ).toBe(99);
    expect(parsePrNumber("https://example.com")).toBeNull();
  });

  it("builds a stable branch name from feedback id", () => {
    expect(
      buildFeedbackAgentBranchName("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("cursor/feedback-550e8400e2");
  });

  it("verifies cursor webhook signatures", () => {
    const secret = "a".repeat(32);
    const body = JSON.stringify({ id: "bc_1", status: "FINISHED" });
    const digest = createHmac("sha256", secret).update(body).digest("hex");
    expect(
      verifyCursorWebhookSignature(body, `sha256=${digest}`, secret),
    ).toBe(true);
    expect(
      verifyCursorWebhookSignature(body, `sha256=${"b".repeat(64)}`, secret),
    ).toBe(false);
  });
});

describe("feedback prompt generation", () => {
  it("builds a template prompt with quality gates when AI is offline", async () => {
    const prompt = await generateFeedbackAgentPrompt({
      id: "550e8400-e29b-41d4-a716-446655440000",
      kind: "bug",
      title: "Header overflow on mobile",
      body: "The header wraps incorrectly under 400px.",
      screenshotUrl: "https://example.com/shot.png",
      userEmail: "user@example.com",
    });

    expect(prompt).toContain("Header overflow on mobile");
    expect(prompt).toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(prompt).toContain("no merge conflicts");
    expect(prompt).toContain("pnpm typecheck");
    expect(prompt).toContain("https://example.com/shot.png");
  });

  it("wraps prompts with operational constraints", () => {
    const wrapped = wrapPromptForCloudAgent({
      feedbackId: "abc",
      prompt: "Fix the bug",
    });
    expect(wrapped).toContain("Fix the bug");
    expect(wrapped).toContain("Feedback ID: abc");
    expect(wrapped).toContain("no merge conflicts");
  });
});
