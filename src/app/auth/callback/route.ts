import { NextResponse } from "next/server";
import { getMfaStatus } from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const status = await getMfaStatus(supabase);
      if (status.needsChallenge) {
        const params = new URLSearchParams({ next });
        return NextResponse.redirect(
          `${origin}/auth/mfa?${params.toString()}`,
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
