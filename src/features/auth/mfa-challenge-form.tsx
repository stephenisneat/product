"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMfaStatus, verifyTotpCode } from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/redirect";

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const status = await getMfaStatus(supabase);
      if (!status.needsChallenge) {
        router.replace(safeNextPath(searchParams.get("next")));
        return;
      }
      const factor = status.verifiedFactors[0];
      if (!factor) {
        setError("No authenticator is set up for this account.");
        setLoading(false);
        return;
      }
      setFactorId(factor.id);
      setLoading(false);
    }
    void load();
  }, [router, searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: verifyError } = await verifyTotpCode(
        supabase,
        factorId,
        code,
      );
      if (verifyError) {
        setError(verifyError);
        return;
      }
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Checking authentication…</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Two-factor authentication
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Authentication code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono tracking-widest"
            maxLength={6}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || code.trim().length < 6}
        >
          {busy ? "Verifying…" : "Verify"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={busy}
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}
