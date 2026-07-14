import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/mode";

export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}
