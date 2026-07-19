import { createClient } from "@/lib/supabase/server";

/** Decode `session_id` from a Supabase access token JWT. */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const json = Buffer.from(payloadPart, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return sessionIdFromAccessToken(session.access_token);
}

export type AuthSessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  ip: string | null;
};

export type SessionEventRow = {
  id: string;
  user_id: string;
  session_id: string;
  event: "login" | "revoke";
  user_agent: string | null;
  ip: string | null;
  created_at: string;
};
