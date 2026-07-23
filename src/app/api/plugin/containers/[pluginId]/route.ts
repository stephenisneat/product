import { NextResponse } from "next/server";
import {
  bumpPluginDraft,
  PLUGIN_CONTAINER_SELECT,
  requirePluginContainer,
} from "@/lib/plugin/auth";
import { buildInstallSnippet } from "@/lib/plugin/install-snippet";
import { publishPluginContainerSnapshot } from "@/lib/plugin/publish-snapshot";
import { isPluginInstallPlatform } from "@/features/plugin/install-platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ pluginId: string }> };

async function fetchContainerPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  containerId: string,
) {
  const { data: container, error: cErr } = await client
    .from("plugin_containers")
    .select(PLUGIN_CONTAINER_SELECT)
    .eq("id", containerId)
    .maybeSingle();

  if (cErr || !container) {
    return { error: "Plugin not found", status: 404 as const };
  }

  const [
    { data: tags },
    { data: triggers },
    { data: variables },
    { data: versions },
  ] = await Promise.all([
    client
      .from("plugin_container_tags")
      .select("*")
      .eq("container_id", containerId)
      .order("priority"),
    client
      .from("plugin_container_triggers")
      .select("*")
      .eq("container_id", containerId)
      .order("created_at"),
    client
      .from("plugin_container_variables")
      .select("*")
      .eq("container_id", containerId)
      .order("created_at"),
    client
      .from("plugin_container_versions")
      .select("id, version, notes, published_by, created_at")
      .eq("container_id", containerId)
      .order("version", { ascending: false })
      .limit(20),
  ]);

  return {
    container,
    tags: tags ?? [],
    triggers: triggers ?? [],
    variables: variables ?? [],
    versions: versions ?? [],
    installSnippet: buildInstallSnippet(containerId),
  };
}

export async function GET(_req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = await fetchContainerPayload(auth.client, auth.containerId);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json(payload);
}

export async function POST(req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, containerId, workspaceId, user } = auth;
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = body?.action as string | undefined;

  switch (action) {
    case "create_tag": {
      const { data: tag, error } = await client
        .from("plugin_container_tags")
        .insert({
          container_id: containerId,
          name: (body?.name as string) || "New Tag",
          type: (body?.type as string) || "pixel",
          config: (body?.config as Record<string, unknown>) || {},
          trigger_ids: (body?.trigger_ids as string[]) || [],
          priority: (body?.priority as number) || 0,
          consent_category: (body?.consent_category as string) || "necessary",
          rate_limit_exempt: (body?.rate_limit_exempt as boolean) || false,
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await bumpPluginDraft(client, containerId);
      return NextResponse.json({ tag });
    }

    case "create_trigger": {
      const { data: trigger, error } = await client
        .from("plugin_container_triggers")
        .insert({
          container_id: containerId,
          name: (body?.name as string) || "New Trigger",
          type: (body?.type as string) || "pageview",
          config: (body?.config as Record<string, unknown>) || {},
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await bumpPluginDraft(client, containerId);
      return NextResponse.json({ trigger });
    }

    case "create_variable": {
      const { data: variable, error } = await client
        .from("plugin_container_variables")
        .insert({
          container_id: containerId,
          name: (body?.name as string) || "new_variable",
          type: (body?.type as string) || "constant",
          config: (body?.config as Record<string, unknown>) || {},
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await bumpPluginDraft(client, containerId);
      return NextResponse.json({ variable });
    }

    case "publish": {
      try {
        const { version } = await publishPluginContainerSnapshot(
          client,
          containerId,
          {
            notes: (body?.notes as string | null) ?? null,
            publishedBy: user.id,
            enabledTagsOnly: true,
            workspaceId,
            pluginId: containerId,
          },
        );
        return NextResponse.json({ published: true, version });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, containerId } = auth;
  const body = (await req.json()) as {
    entity?: string;
    id?: string;
    name?: string;
    platform?: string;
    domain?: string | null;
    [key: string]: unknown;
  };

  // Meta update (name / platform / domain) when entity is omitted.
  if (!body.entity) {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updates.name = trimmed;
    }
    if (typeof body.platform === "string") {
      if (!isPluginInstallPlatform(body.platform)) {
        return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
      }
      updates.platform = body.platform;
    }
    if (body.domain !== undefined) {
      updates.domain =
        typeof body.domain === "string" && body.domain.trim()
          ? body.domain.trim()
          : null;
    }

    const { data, error } = await client
      .from("plugin_containers")
      .update(updates)
      .eq("id", containerId)
      .select(PLUGIN_CONTAINER_SELECT)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ container: data });
  }

  const { entity, id: entityId, ...updates } = body;
  if (!entityId || typeof entityId !== "string") {
    return NextResponse.json({ error: "Entity id required" }, { status: 400 });
  }

  const table =
    entity === "tag"
      ? "plugin_container_tags"
      : entity === "trigger"
        ? "plugin_container_triggers"
        : entity === "variable"
          ? "plugin_container_variables"
          : null;
  if (!table) {
    return NextResponse.json(
      { error: `Unknown entity: ${entity}` },
      { status: 400 },
    );
  }

  const { data: row, error: rowErr } = await client
    .from(table)
    .select("id, container_id")
    .eq("id", entityId)
    .maybeSingle();
  if (rowErr || !row || row.container_id !== containerId) {
    return NextResponse.json(
      { error: "Entity not found in this plugin" },
      { status: 404 },
    );
  }

  const { entity: _e, id: _i, ...entityUpdates } = updates as Record<
    string,
    unknown
  > & { entity?: string; id?: string };

  const { data, error } = await client
    .from(table)
    .update({ ...entityUpdates, updated_at: new Date().toISOString() })
    .eq("id", entityId)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await bumpPluginDraft(client, containerId);
  return NextResponse.json({ [entity as string]: data });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { pluginId } = await context.params;
  const auth = await requirePluginContainer(pluginId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, containerId } = auth;

  let body: { entity?: string; id?: string } | null = null;
  try {
    body = (await req.json()) as { entity?: string; id?: string };
  } catch {
    body = null;
  }

  // No body / no entity → delete the whole plugin.
  if (!body?.entity) {
    const { error } = await client
      .from("plugin_containers")
      .delete()
      .eq("id", containerId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: true });
  }

  const { entity, id: entityId } = body;
  if (!entityId) {
    return NextResponse.json({ error: "Entity id required" }, { status: 400 });
  }

  const table =
    entity === "tag"
      ? "plugin_container_tags"
      : entity === "trigger"
        ? "plugin_container_triggers"
        : entity === "variable"
          ? "plugin_container_variables"
          : null;
  if (!table) {
    return NextResponse.json(
      { error: `Unknown entity: ${entity}` },
      { status: 400 },
    );
  }

  const { data: row } = await client
    .from(table)
    .select("container_id")
    .eq("id", entityId)
    .maybeSingle();
  if (!row || row.container_id !== containerId) {
    return NextResponse.json(
      { error: "Entity not found in this plugin" },
      { status: 404 },
    );
  }

  const { error } = await client.from(table).delete().eq("id", entityId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await bumpPluginDraft(client, containerId);
  return NextResponse.json({ deleted: true });
}
