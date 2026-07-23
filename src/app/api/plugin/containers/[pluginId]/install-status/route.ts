import { NextResponse } from "next/server";
import { requirePluginContainer } from "@/lib/plugin/auth";
import { loadPluginInstallStatus } from "@/lib/plugin/install-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ pluginId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = await loadPluginInstallStatus({
    client: auth.client,
    pluginId: auth.containerId,
    domain: auth.container.domain,
    platform: auth.container.platform,
  });

  return NextResponse.json(status);
}
