import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Platform Admin Center access.
 * Grant manually in Supabase (no self-serve UI):
 *   update public.profiles set is_platform_admin = true where email = 'you@example.com';
 */
export const isPlatformAdmin = cache(async (userId: string): Promise<boolean> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return false;
    return Boolean(
      (data as { is_platform_admin?: boolean }).is_platform_admin,
    );
  } catch {
    return false;
  }
});
