import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { ensurePluginContainer } from "@/lib/plugin/ensure-container";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const client = hasServiceRole()
    ? createServiceClient()
    : await createClient();

  const ensured = await ensurePluginContainer(client, active.workspace.id);
  if (!ensured.id) {
    return NextResponse.json(
      { error: "Failed to resolve plugin container" },
      { status: 500 },
    );
  }

  const workspaceId = active.workspace.id;
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: latest }, { count: lastHourCount }, { count: lastDayCount }] =
    await Promise.all([
      client
        .from("plugin_measurement_events")
        .select("created_at, event_type, event_name")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("plugin_measurement_events")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", hourAgo),
      client
        .from("plugin_measurement_events")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", dayAgo),
    ]);

  return NextResponse.json({
    has_ever_received: !!latest,
    last_event_at: latest?.created_at ?? null,
    last_event_type: latest?.event_type ?? null,
    last_event_name: latest?.event_name ?? null,
    last_hour_count: lastHourCount ?? 0,
    last_day_count: lastDayCount ?? 0,
  });
}
