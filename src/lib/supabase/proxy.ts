import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { enforceMfaGate } from "@/lib/auth/mfa-gate";
import { getSupabasePublishableKey } from "@/lib/mode";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  }[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet);
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const gated = await enforceMfaGate(request, supabase, user.id);
    if (gated) {
      pendingCookies.forEach(({ name, value, options }) => {
        gated.cookies.set(name, value, options);
      });
      return gated;
    }
  }

  return supabaseResponse;
}
