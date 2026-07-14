"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authCallbackUrl } from "@/lib/auth/redirect";

export function CheckEmailPanel({ email }: { email: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onResend() {
    if (!email) {
      setError("Missing email address. Sign up again to receive a confirmation link.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin, "/auth/verified"),
      },
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage("Confirmation email resent. Check your inbox.");
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="font-heading text-xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Open it to verify your
            account.
          </>
        ) : (
          <>We sent a confirmation link to your email. Open it to verify your account.</>
        )}
      </p>

      <div className="mt-8 space-y-3">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading || !email}
          onClick={onResend}
        >
          {loading ? "Sending…" : "Resend confirmation email"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Wrong address?{" "}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Sign up again
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
