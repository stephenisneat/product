import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getCurrentSessionId,
  type AuthSessionRow,
  type SessionEventRow,
} from "@/lib/auth/sessions";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
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

  const { data: sessions, error: sessionsError } = await service
    .schema("auth")
    .from("sessions")
    .select("id, user_id, created_at, updated_at, refreshed_at, user_agent, ip")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  const active = (sessions ?? []) as AuthSessionRow[];

  // Record login events for newly seen active sessions.
  for (const session of active) {
    const { data: existing } = await service
      .from("user_session_events")
      .select("id")
      .eq("session_id", session.id)
      .eq("event", "login")
      .maybeSingle();

    if (!existing) {
      await service.from("user_session_events").insert({
        user_id: user.id,
        session_id: session.id,
        event: "login",
        user_agent: session.user_agent,
        ip: session.ip,
        created_at: session.created_at,
      });
    }
  }

  const { data: history, error: historyError } = await service
    .from("user_session_events")
    .select("id, user_id, session_id, event, user_agent, ip, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  return NextResponse.json({
    currentSessionId,
    sessions: active.map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      refreshedAt: s.refreshed_at,
      userAgent: s.user_agent,
      ip: s.ip,
      isCurrent: s.id === currentSessionId,
    })),
    history: ((history ?? []) as SessionEventRow[]).map((e) => ({
      id: e.id,
      sessionId: e.session_id,
      event: e.event,
      userAgent: e.user_agent,
      ip: e.ip,
      createdAt: e.created_at,
    })),
  });
}
