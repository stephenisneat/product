import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, isDemoMode } from "@/lib/mode";

export function createClient() {
  if (isDemoMode()) {
    throw new Error("Supabase browser client is unavailable in demo mode");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getSupabasePublishableKey()!;

  return createBrowserClient(url, key);
}
