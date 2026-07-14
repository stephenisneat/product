import type { AppUser } from "@/domain";
import { getDemoUserFromCookies } from "@/lib/auth/demo-session";
import { isDemoMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isDemoMode()) {
    return getDemoUserFromCookies();
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Allow demo cookie even when Supabase is configured (local convenience).
      return getDemoUserFromCookies();
    }

    return {
      id: user.id,
      email: user.email ?? "unknown@product.ag",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "User",
      isDemo: false,
    };
  } catch {
    return getDemoUserFromCookies();
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
