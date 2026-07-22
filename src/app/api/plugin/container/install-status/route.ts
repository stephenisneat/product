import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { ensurePluginContainer } from "@/lib/plugin/ensure-container";
import { loadPluginInstallStatus } from "@/lib/plugin/install-status";
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

  const status = await loadPluginInstallStatus({
    client,
    workspaceId: active.workspace.id,
    primaryDomain: active.workspace.primaryDomain ?? null,
  });

  return NextResponse.json(status);
}
