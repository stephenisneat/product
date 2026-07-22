import { describe, expect, it } from "vitest";
import type { Goal, JobRun } from "@/domain";
import { buildStubInsight } from "@/lib/jobs/insight-stubs";

const now = "2026-01-15T12:00:00.000Z";

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    productId: "prod_1",
    scope: "product",
    title: "ROAS target",
    metric: "roas",
    targetValue: 3,
    targetUnit: "x",
    horizon: "monthly",
    status: "active",
    notes: "",
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeJob(overrides: Partial<JobRun> = {}): JobRun {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    productId: "prod_1",
    type: "create_campaign",
    status: "succeeded",
    trigger: "agent",
    triggerRunId: null,
    createdBy: null,
    input: {},
    result: null,
    error: null,
    createdAt: now,
    startedAt: now,
    finishedAt: now,
    ...overrides,
  };
}

describe("buildStubInsight kind", () => {
  it("assigns setup when there are no active goals", () => {
    const content = buildStubInsight({ goals: [] });
    expect(content.kind).toBe("setup");
  });

  it("assigns opportunity for a successful campaign job", () => {
    const content = buildStubInsight({
      goals: [makeGoal()],
      sourceJob: makeJob({ status: "succeeded", type: "create_campaign" }),
    });
    expect(content.kind).toBe("opportunity");
  });

  it("assigns blocker for a failed campaign job", () => {
    const content = buildStubInsight({
      goals: [makeGoal()],
      sourceJob: makeJob({
        status: "failed",
        type: "create_campaign",
        error: "brief too vague",
      }),
    });
    expect(content.kind).toBe("blocker");
  });

  it("assigns opportunity for a successful creative job", () => {
    const content = buildStubInsight({
      goals: [makeGoal()],
      sourceJob: makeJob({
        status: "succeeded",
        type: "generate_creative_video",
      }),
    });
    expect(content.kind).toBe("opportunity");
  });

  it("assigns blocker for a failed creative job", () => {
    const content = buildStubInsight({
      goals: [makeGoal()],
      sourceJob: makeJob({
        status: "failed",
        type: "generate_creative_video",
      }),
    });
    expect(content.kind).toBe("blocker");
  });

  it("assigns opportunity for heartbeat ROAS / revenue push", () => {
    const content = buildStubInsight({
      goals: [makeGoal({ metric: "revenue" })],
    });
    expect(content.kind).toBe("opportunity");
  });

  it("assigns idea for generic next-move / deliverable stubs", () => {
    const content = buildStubInsight({
      goals: [makeGoal({ metric: "cac", title: "Lower CAC" })],
    });
    expect(content.kind).toBe("idea");
  });

  it("preserves kind when revising with feedback", () => {
    const content = buildStubInsight({
      goals: [],
      revisionFeedback: "Make it more specific",
    });
    expect(content.kind).toBe("setup");
    expect(content.title).toMatch(/^Revised:/);
  });
});
