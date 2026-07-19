import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentSessionId } from "@/lib/auth/sessions";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: sessionId } = await context.params;
  const currentSessionId = await getCurrentSessionId();
  const service = createServiceClient();

  const { data: session, error: fetchError } = await service
    .schema("auth")
    .from("sessions")
    .select("id, user_id, user_agent, ip")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await service.from("user_session_events").insert({
    user_id: user.id,
    session_id: sessionId,
    event: "revoke",
    user_agent: session.user_agent,
    ip: session.ip,
  });

  const { error: deleteError } = await service
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (sessionId === currentSessionId) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true, signedOut: true });
  }

  return NextResponse.json({ ok: true, signedOut: false });
}
