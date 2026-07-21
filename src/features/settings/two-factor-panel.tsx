"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cleanupUnverifiedMfaFactors,
  getMfaStatus,
  type MfaFactorSummary,
  verifyTotpCode,
} from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/redirect";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function TwoFactorPanel({
  workspaceRequiresMfa = false,
  initialFactors,
}: {
  workspaceRequiresMfa?: boolean;
  initialFactors: MfaFactorSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredByQuery = searchParams.get("required") === "1";
  const required = requiredByQuery || workspaceRequiresMfa;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [factors, setFactors] = useState<MfaFactorSummary[]>(initialFactors);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);

  async function refreshFactors() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const status = await getMfaStatus(supabase);
    setFactors(status.verifiedFactors);
  }

  async function startEnroll() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setCode("");
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await cleanupUnverifiedMfaFactors(supabase);
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrollError) throw enrollError;
      if (!data.totp) throw new Error("Authenticator setup failed");
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start 2FA setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: verifyError } = await verifyTotpCode(
        supabase,
        enroll.factorId,
        code,
      );
      if (verifyError) {
        setError(verifyError);
        return;
      }
      setEnroll(null);
      setCode("");
      setMessage("Two-factor authentication is on.");
      await refreshFactors();
      const next = safeNextPath(searchParams.get("next"));
      if (requiredByQuery && next !== "/settings/security") {
        router.push(next);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enroll) return;
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
      setEnroll(null);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel setup");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!enroll?.secret) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setMessage("Secret copied.");
    } catch {
      setError("Could not copy secret.");
    }
  }

  async function disableFactor(factor: MfaFactorSummary) {
    if (required) {
      setError(
        "Your workspace requires two-factor authentication. Ask the owner to turn that off before disabling 2FA.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const status = await getMfaStatus(supabase);
      if (status.currentLevel !== "aal2") {
        const { error: verifyError } = await verifyTotpCode(
          supabase,
          factor.id,
          disableCode,
        );
        if (verifyError) {
          setError(verifyError);
          return;
        }
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (unenrollError) throw unenrollError;
      setConfirmDisable(false);
      setDisableCode("");
      setMessage("Two-factor authentication is off.");
      await refreshFactors();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setBusy(false);
    }
  }

  const enabled = factors.length > 0;

  return (
    <div className="space-y-4">
      {required && !enabled ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This workspace requires two-factor authentication before you can
          continue.
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-sm text-foreground">
          {enabled
            ? "Two-factor authentication is enabled."
            : "Add an authenticator app for a second step when you sign in."}
        </p>
        <p className="text-xs text-muted-foreground">
          Optional for your account. Workspace owners can require it for
          everyone in a workspace.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {enroll ? (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scan this QR code</p>
            <p className="text-xs text-muted-foreground">
              Use Google Authenticator, 1Password, Authy, or any TOTP app.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enroll.qrCode}
              alt="Two-factor authentication QR code"
              className="size-44 rounded-md border border-border bg-white p-2"
            />
            <div className="space-y-1.5">
              <Label htmlFor="totp-secret">Or enter this secret</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="totp-secret"
                  value={enroll.secret}
                  readOnly
                  className="max-w-sm font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void copySecret()}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totp-code">Verification code</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[10rem] font-mono tracking-widest"
              maxLength={6}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || code.trim().length < 6}
              onClick={() => void confirmEnroll()}
            >
              {busy ? "Verifying…" : "Confirm and enable"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void cancelEnroll()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {!enroll && !enabled ? (
        <Button
          type="button"
          disabled={busy}
          onClick={() => void startEnroll()}
        >
          {busy ? "Starting…" : "Set up two-factor authentication"}
        </Button>
      ) : null}

      {!enroll && enabled
        ? factors.map((factor) => (
            <div
              key={factor.id}
              className="space-y-3 rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {factor.friendlyName || "Authenticator app"}
                </p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
              {confirmDisable ? (
                <div className="space-y-3">
                  {required ? (
                    <p className="text-sm text-destructive">
                      Your workspace requires 2FA, so it can’t be turned off
                      here.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="disable-totp-code">
                          Enter a code to disable 2FA
                        </Label>
                        <Input
                          id="disable-totp-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={disableCode}
                          onChange={(e) => setDisableCode(e.target.value)}
                          className="max-w-[10rem] font-mono tracking-widest"
                          maxLength={6}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={busy || disableCode.trim().length < 6}
                          onClick={() => void disableFactor(factor)}
                        >
                          Disable 2FA
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setConfirmDisable(false);
                            setDisableCode("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || required}
                  onClick={() => setConfirmDisable(true)}
                >
                  Disable
                </Button>
              )}
            </div>
          ))
        : null}
    </div>
  );
}
