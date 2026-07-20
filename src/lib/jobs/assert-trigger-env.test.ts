import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertSupabaseUrlForTrigger,
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";

describe("assertTriggerJobEnv", () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;

  const snapshot: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of keys) {
      snapshot[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("throws when required env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => assertTriggerJobEnv()).toThrow(/missing env/i);
  });

  it("passes when supabase url, publishable key, and service role are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

    expect(() => assertTriggerJobEnv()).not.toThrow();
  });

  it("throws when supabase url is a bare supabase.com host", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.com";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

    expect(() => assertTriggerJobEnv()).toThrow(/not a project URL/i);
  });
});

describe("assertSupabaseUrlForTrigger", () => {
  it("accepts project subdomain urls and localhost", () => {
    expect(() =>
      assertSupabaseUrlForTrigger("https://abcd1234.supabase.co"),
    ).not.toThrow();
    expect(() =>
      assertSupabaseUrlForTrigger("http://127.0.0.1:54321"),
    ).not.toThrow();
  });

  it("rejects invalid and non-project hosts", () => {
    expect(() => assertSupabaseUrlForTrigger("not-a-url")).toThrow(/valid URL/i);
    expect(() =>
      assertSupabaseUrlForTrigger("https://api.supabase.com"),
    ).toThrow(/not a project URL/i);
  });
});

describe("clarifyTriggerSupabaseError", () => {
  it("rewrites Project not specified", () => {
    const out = clarifyTriggerSupabaseError("Project not specified.");
    expect(out).toMatch(/Trigger worker/i);
    expect(out).toMatch(/Project URL/i);
  });

  it("leaves other messages alone", () => {
    expect(clarifyTriggerSupabaseError("Creative not found.")).toBe(
      "Creative not found.",
    );
  });
});
