import { describe, expect, it, vi } from "vitest";
import {
  isMfaEnrollAllowlisted,
  isMfaExemptPath,
} from "@/lib/auth/mfa-gate";

describe("mfa-gate paths", () => {
  it("exempts auth and invite flows", () => {
    expect(isMfaExemptPath("/login")).toBe(true);
    expect(isMfaExemptPath("/signup")).toBe(true);
    expect(isMfaExemptPath("/privacy")).toBe(true);
    expect(isMfaExemptPath("/terms")).toBe(true);
    expect(isMfaExemptPath("/pricing")).toBe(true);
    expect(isMfaExemptPath("/auth/mfa")).toBe(true);
    expect(isMfaExemptPath("/auth/callback")).toBe(true);
    expect(isMfaExemptPath("/invite/abc")).toBe(true);
    expect(isMfaExemptPath("/api/auth/sessions")).toBe(true);
    expect(isMfaExemptPath("/settings/security")).toBe(false);
    expect(isMfaExemptPath("/")).toBe(false);
    expect(isMfaExemptPath("/api/workspaces")).toBe(false);
  });

  it("allowlists security settings for enrollment", () => {
    expect(isMfaEnrollAllowlisted("/settings/security")).toBe(true);
    expect(isMfaEnrollAllowlisted("/settings/workspace")).toBe(false);
  });
});

describe("getMfaAssurance", () => {
  it("derives challenge and verified-factor from AAL only", async () => {
    const { getMfaAssurance } = await import("@/lib/auth/mfa");
    const getAal = vi.fn(async () => ({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    }));
    const listFactors = vi.fn();
    const supabase = {
      auth: { mfa: { getAuthenticatorAssuranceLevel: getAal, listFactors } },
    };
    // @ts-expect-error minimal mock
    const status = await getMfaAssurance(supabase);
    expect(status.needsChallenge).toBe(true);
    expect(status.hasVerifiedFactor).toBe(true);
    expect(listFactors).not.toHaveBeenCalled();
  });

  it("treats aal1/aal1 as no verified factor", async () => {
    const { getMfaAssurance } = await import("@/lib/auth/mfa");
    const supabase = {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: { currentLevel: "aal1", nextLevel: "aal1" },
            error: null,
          }),
          listFactors: vi.fn(),
        },
      },
    };
    // @ts-expect-error minimal mock
    const status = await getMfaAssurance(supabase);
    expect(status.needsChallenge).toBe(false);
    expect(status.hasVerifiedFactor).toBe(false);
  });
});

describe("totp code shape", () => {
  it("accepts only 6 digit codes in verify helper contract", async () => {
    const { verifyTotpCode } = await import("@/lib/auth/mfa");
    const supabase = {
      auth: {
        mfa: {
          challenge: async () => ({ data: { id: "c1" }, error: null }),
          verify: async () => ({ data: {}, error: null }),
        },
      },
    };
    // @ts-expect-error minimal mock
    const bad = await verifyTotpCode(supabase, "f1", "12");
    expect(bad.error).toMatch(/6-digit/);

    // @ts-expect-error minimal mock
    const ok = await verifyTotpCode(supabase, "f1", "123456");
    expect(ok.error).toBeNull();
  });
});
