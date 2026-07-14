"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDivider, GoogleAuthButton } from "@/features/auth/oauth-buttons";
import { authCallbackUrl } from "@/lib/auth/redirect";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError =
    searchParams.get("error") === "auth"
      ? "Sign-in link expired or was invalid. Try again."
      : null;
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [magicLoading, setMagicLoading] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setMessage(null);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setError("Confirm your email before signing in.");
        router.push(`/auth/check-email?email=${encodeURIComponent(values.email)}`);
        return;
      }
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function onMagicLink() {
    setError(null);
    setMessage(null);

    const emailValid = await trigger("email");
    if (!emailValid) {
      return;
    }

    const email = getValues("email");
    setMagicLoading(true);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin, "/"),
        shouldCreateUser: false,
      },
    });

    setMagicLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setMessage("Check your email for a magic sign-in link.");
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="font-heading text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Access your product marketing workspace.
      </p>

      <div className="mt-8 space-y-4">
        <GoogleAuthButton
          onError={(msg) => {
            setError(msg || null);
          }}
        />
        <AuthDivider />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Sign in
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={magicLoading || isSubmitting}
          onClick={onMagicLink}
        >
          {magicLoading ? "Sending link…" : "Email me a magic link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
