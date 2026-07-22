import { describe, expect, it } from "vitest";
import { creativePatchAfterEnqueueFailure } from "@/lib/jobs/enqueue";

describe("creativePatchAfterEnqueueFailure", () => {
  it("parks as paused without changing stage when no rollback is set", () => {
    expect(creativePatchAfterEnqueueFailure({})).toEqual({
      status: "paused",
      activeJobId: null,
    });
  });

  it("rolls back stage on Accept→next enqueue failure", () => {
    expect(
      creativePatchAfterEnqueueFailure({ rollbackStage: "screenplay" }),
    ).toEqual({
      status: "paused",
      activeJobId: null,
      stage: "screenplay",
    });
  });
});
