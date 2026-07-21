import { describe, expect, it } from "vitest";
import { unknownErrorMessage, userFacingErrorMessage } from "@/lib/errors";

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

describe("userFacingErrorMessage", () => {
  it("collapses Next.js 500 HTML into a short message", () => {
    const html =
      '<!DOCTYPE html><html id="__next_error__"><title>500: This page couldn’t load</title></html>';
    expect(userFacingErrorMessage(new Error(html))).toBe(
      "A server error occurred. Please try again.",
    );
  });

  it("passes through short normal errors", () => {
    expect(userFacingErrorMessage(new Error("Product not found"))).toBe(
      "Product not found",
    );
  });
});
