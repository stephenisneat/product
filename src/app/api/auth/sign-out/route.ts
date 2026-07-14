import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, demoSessionCookieOptions } from "@/lib/auth/demo-session";
import { isDemoMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    ...demoSessionCookieOptions({ maxAgeSeconds: 0 }),
    maxAge: 0,
  });

  if (!isDemoMode()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore when cookies cannot be written from this path.
    }
  }

  return response;
}
