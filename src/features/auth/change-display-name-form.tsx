"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

type FormValues = z.infer<typeof schema>;

export function ChangeDisplayNameForm({
  currentName,
}: {
  currentName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: currentName },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setMessage(null);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to update your name.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: values.name },
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: values.name })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setMessage("Display name updated.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          type="text"
          autoComplete="name"
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
