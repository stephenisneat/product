"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authCallbackUrl } from "@/lib/auth/redirect";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setMessage(null);

    if (values.email.toLowerCase() === currentEmail.toLowerCase()) {
      setError("Enter a different email address.");
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser(
      { email: values.email },
      {
        emailRedirectTo: authCallbackUrl(
          window.location.origin,
          "/settings/profile?emailUpdated=1",
        ),

      },
    );

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      `Confirm the link sent to ${values.email}. Your address updates after you open that email.`,
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-email">Current email</Label>
        <Input id="current-email" type="email" value={currentEmail} readOnly disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">New email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Update email"}
      </Button>
    </form>
  );
}
