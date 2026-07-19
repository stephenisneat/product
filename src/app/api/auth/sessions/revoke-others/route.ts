import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentSessionId, type AuthSessionRow } from "@/lib/auth/sessions";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Session management is not configured" },
      { status: 503 },
    );
  }

  const currentSessionId = await getCurrentSessionId();
  const service = createServiceClient();

  const { data: sessions, error: listError } = await service
    .schema("auth")
    .from("sessions")
    .select("id, user_id, user_agent, ip")
    .eq("user_id", user.id);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const others = ((sessions ?? []) as AuthSessionRow[]).filter(
    (s) => s.id !== currentSessionId,
  );

  for (const session of others) {
    await service.from("user_session_events").insert({
      user_id: user.id,
      session_id: session.id,
      event: "revoke",
      user_agent: session.user_agent,
      ip: session.ip,
    });
  }

  if (others.length > 0) {
    const { error: deleteError } = await service
      .schema("auth")
      .from("sessions")
      .delete()
      .eq("user_id", user.id)
      .neq("id", currentSessionId ?? "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      // Fall back to signOut scope if direct delete fails.
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "others" });
    }
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "others" });
  }

  return NextResponse.json({ ok: true, revoked: others.length });
}
