import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { ensurePluginContainer } from "@/lib/plugin/ensure-container";
import { getPluginBaseUrl } from "@/lib/plugin/install-snippet";
import { loadPluginInstallStatus } from "@/lib/plugin/install-status";
import type { PluginPingResult } from "@/lib/plugin/types";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probe(url: string): Promise<{ ok: boolean; json?: unknown }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false };
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return { ok: true, json: await res.json() };
    }
    // Consume body so the connection can close cleanly.
    await res.arrayBuffer();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function POST() {
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

  const base = getPluginBaseUrl();
  const workspaceId = active.workspace.id;

  const [scriptProbe, containerProbe, status] = await Promise.all([
    probe(`${base}/v1/plugin.js`),
    probe(`${base}/api/t/container/ws/${workspaceId}`),
    loadPluginInstallStatus({
      client,
      workspaceId,
      primaryDomain: active.workspace.primaryDomain ?? null,
    }),
  ]);

  let containerVersion: number | null = null;
  if (
    containerProbe.json &&
    typeof containerProbe.json === "object" &&
    containerProbe.json !== null &&
    "version" in containerProbe.json &&
    typeof (containerProbe.json as { version: unknown }).version === "number"
  ) {
    containerVersion = (containerProbe.json as { version: number }).version;
  }

  const result: PluginPingResult = {
    ok: scriptProbe.ok && containerProbe.ok,
    script_reachable: scriptProbe.ok,
    container_reachable: containerProbe.ok,
    container_version: containerVersion,
    status,
    ...(!scriptProbe.ok || !containerProbe.ok
      ? {
          error: !scriptProbe.ok
            ? "Could not reach the plugin script"
            : "Could not reach the plugin container API",
        }
      : {}),
  };

  return NextResponse.json(result);
}
