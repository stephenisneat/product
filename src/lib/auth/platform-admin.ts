import { cache } from "react";
import type { AppUser } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Platform Admin Center access.
 * Grant via Admin Center → Team (service role), or manually in Supabase:
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

export async function requirePlatformAdmin(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const allowed = await isPlatformAdmin(user.id);
  if (!allowed) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, user };
}
