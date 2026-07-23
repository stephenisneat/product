import { NextResponse } from "next/server";
import {
  PLUGIN_CONTAINER_SELECT,
  requirePluginWorkspace,
} from "@/lib/plugin/auth";
import { buildInstallSnippet } from "@/lib/plugin/install-snippet";
import { loadPluginInstallStatus } from "@/lib/plugin/install-status";
import { isPluginInstallPlatform } from "@/features/plugin/install-platforms";
import type { PluginListItem } from "@/lib/plugin/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePluginWorkspace();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: containers, error } = await auth.client
    .from("plugin_containers")
    .select(PLUGIN_CONTAINER_SELECT)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const plugins: PluginListItem[] = await Promise.all(
    (containers ?? []).map(async (container: PluginListItem["container"]) => {
      const status = await loadPluginInstallStatus({
        client: auth.client,
        pluginId: container.id,
        domain: container.domain,
        platform: container.platform,
      });
      return {
        container,
        installSnippet: buildInstallSnippet(container.id),
        status,
      };
    }),
  );

  return NextResponse.json({ plugins });
}

export async function POST(req: Request) {
  const auth = await requirePluginWorkspace();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    platform?: string;
    domain?: string | null;
  } | null;

  const name = body?.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const platform = body?.platform ?? "";
  if (!isPluginInstallPlatform(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const domain =
    typeof body?.domain === "string" && body.domain.trim()
      ? body.domain.trim()
      : null;

  const { data: container, error } = await auth.client
    .from("plugin_containers")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      platform,
      domain,
    })
    .select(PLUGIN_CONTAINER_SELECT)
    .single();

  if (error || !container) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create plugin" },
      { status: 500 },
    );
  }

  const status = await loadPluginInstallStatus({
    client: auth.client,
    pluginId: container.id,
    domain: container.domain,
    platform: container.platform,
  });

  return NextResponse.json(
    {
      container,
      installSnippet: buildInstallSnippet(container.id),
      status,
    },
    { status: 201 },
  );
}
