import { describe, expect, it } from "vitest";
import { unknownErrorMessage } from "@/lib/errors";

describe("unknownErrorMessage", () => {
  it("reads Error.message", () => {
    expect(unknownErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("reads Postgrest-style plain objects", () => {
    expect(
      unknownErrorMessage(
        {
          message: 'relation "creatives" does not exist',
          code: "42P01",
          details: null,
        },
        "fallback",
      ),
    ).toBe('relation "creatives" does not exist (42P01)');
  });

  it("falls back for empty values", () => {
    expect(unknownErrorMessage(null, "fallback")).toBe("fallback");
    expect(unknownErrorMessage({}, "fallback")).toBe("fallback");
  });
});
