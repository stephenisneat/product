import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { ensurePluginContainer } from "@/lib/plugin/ensure-container";
import { buildInstallSnippet } from "@/lib/plugin/install-snippet";
import { publishPluginContainerSnapshot } from "@/lib/plugin/publish-snapshot";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireWorkspaceContainer() {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return { ok: false as const, status: 400, error: "No workspace available" };
  }

  const client = hasServiceRole()
    ? createServiceClient()
    : await createClient();

  const ensured = await ensurePluginContainer(client, active.workspace.id);
  if (!ensured.id) {
    return {
      ok: false as const,
      status: 500,
      error: "Failed to resolve plugin container",
    };
  }

  return {
    ok: true as const,
    user,
    workspaceId: active.workspace.id,
    containerId: ensured.id,
    client,
  };
}

async function fetchContainerPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  containerId: string,
  workspaceId: string,
) {
  const { data: container, error: cErr } = await client
    .from("plugin_containers")
    .select(
      "id, workspace_id, published_version, draft_version, published_at, created_at, updated_at",
    )
    .eq("id", containerId)
    .maybeSingle();

  if (cErr || !container) {
    return { error: "Container not found", status: 404 as const };
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
    installSnippet: buildInstallSnippet(workspaceId),
  };
}

export async function GET() {
  const auth = await requireWorkspaceContainer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = await fetchContainerPayload(
    auth.client,
    auth.containerId,
    auth.workspaceId,
  );
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const auth = await requireWorkspaceContainer();
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
      await bumpDraft(client, containerId);
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
      await bumpDraft(client, containerId);
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
      await bumpDraft(client, containerId);
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

export async function PATCH(req: Request) {
  const auth = await requireWorkspaceContainer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, containerId } = auth;
  const body = (await req.json()) as {
    entity: string;
    id: string;
    [key: string]: unknown;
  };
  const { entity, id: entityId, ...updates } = body;

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
      { error: "Entity not found in this container" },
      { status: 404 },
    );
  }

  const { data, error } = await client
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", entityId)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await bumpDraft(client, containerId);
  return NextResponse.json({ [entity]: data });
}

export async function DELETE(req: Request) {
  const auth = await requireWorkspaceContainer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, containerId } = auth;
  const { entity, id: entityId } = (await req.json()) as {
    entity: string;
    id: string;
  };

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
      { error: "Entity not found in this container" },
      { status: 404 },
    );
  }

  const { error } = await client.from(table).delete().eq("id", entityId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await bumpDraft(client, containerId);
  return NextResponse.json({ deleted: true });
}

async function bumpDraft(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  containerId: string,
) {
  const { data: container } = await client
    .from("plugin_containers")
    .select("draft_version, published_version")
    .eq("id", containerId)
    .maybeSingle();
  if (!container) return;

  const published = (container.published_version as number) ?? 0;
  const draft = (container.draft_version as number) ?? 1;
  const nextDraft = draft <= published ? published + 1 : draft;

  await client
    .from("plugin_containers")
    .update({
      draft_version: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", containerId);
}
