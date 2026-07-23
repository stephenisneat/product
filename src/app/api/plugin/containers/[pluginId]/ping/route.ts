import { NextResponse } from "next/server";
import { requirePluginContainer } from "@/lib/plugin/auth";
import { getPluginBaseUrl } from "@/lib/plugin/install-snippet";
import { loadPluginInstallStatus } from "@/lib/plugin/install-status";
import type { PluginPingResult } from "@/lib/plugin/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ pluginId: string }> };

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
    await res.arrayBuffer();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function POST(_req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const base = getPluginBaseUrl();

  const [scriptProbe, containerProbe, status] = await Promise.all([
    probe(`${base}/v1/plugin.js`),
    probe(`${base}/api/t/container/p/${auth.containerId}`),
    loadPluginInstallStatus({
      client: auth.client,
      pluginId: auth.containerId,
      domain: auth.container.domain,
      platform: auth.container.platform,
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
