"use client";

import { createClient } from "@/lib/supabase/client";

export async function getCurrentUserIdForUpload(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("You must be signed in to attach a screenshot");
  }
  return data.user.id;
}
