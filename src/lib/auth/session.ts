import { cache } from "react";
import type { AppUser } from "@/domain";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? "unknown@product.ag",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "User",
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
