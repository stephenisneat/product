import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaAssuranceLevel = "aal1" | "aal2";

export type MfaFactorSummary = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  factorType: string;
};

export type MfaStatus = {
  currentLevel: MfaAssuranceLevel | null;
  nextLevel: MfaAssuranceLevel | null;
  verifiedFactors: MfaFactorSummary[];
  unverifiedFactors: MfaFactorSummary[];
  hasVerifiedFactor: boolean;
  needsChallenge: boolean;
};

function mapFactor(factor: {
  id: string;
  friendly_name?: string | null;
  status: string;
  factor_type: string;
}): MfaFactorSummary {
  return {
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    status: factor.status === "verified" ? "verified" : "unverified",
    factorType: factor.factor_type,
  };
}

export async function getMfaStatus(
  supabase: SupabaseClient,
): Promise<MfaStatus> {
  try {
    const [{ data: aal }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    const totp = (factors?.totp ?? []).map(mapFactor);
    const phone = (factors?.phone ?? []).map(mapFactor);
    const all = [...totp, ...phone];
    const verifiedFactors = all.filter((f) => f.status === "verified");
    const unverifiedFactors = all.filter((f) => f.status === "unverified");
    const currentLevel = (aal?.currentLevel as MfaAssuranceLevel | null) ?? null;
    const nextLevel = (aal?.nextLevel as MfaAssuranceLevel | null) ?? null;

    return {
      currentLevel,
      nextLevel,
      verifiedFactors,
      unverifiedFactors,
      hasVerifiedFactor: verifiedFactors.length > 0,
      needsChallenge: currentLevel === "aal1" && nextLevel === "aal2",
    };
  } catch {
    return {
      currentLevel: null,
      nextLevel: null,
      verifiedFactors: [],
      unverifiedFactors: [],
      hasVerifiedFactor: false,
      needsChallenge: false,
    };
  }
}

export async function cleanupUnverifiedMfaFactors(
  supabase: SupabaseClient,
): Promise<void> {
  const status = await getMfaStatus(supabase);
  await Promise.all(
    status.unverifiedFactors.map((factor) =>
      supabase.auth.mfa.unenroll({ factorId: factor.id }),
    ),
  );
}

export async function verifyTotpCode(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
): Promise<{ error: string | null }> {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    return { error: challengeError.message };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: normalized,
  });
  if (verifyError) {
    return { error: verifyError.message };
  }

  return { error: null };
}
