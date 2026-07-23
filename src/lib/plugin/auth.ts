import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export type PluginAuthOk = {
  ok: true;
  user: { id: string };
  workspaceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
};

export type PluginAuthErr = {
  ok: false;
  status: number;
  error: string;
};

export async function requirePluginWorkspace(): Promise<
  PluginAuthOk | PluginAuthErr
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return { ok: false, status: 400, error: "No workspace available" };
  }

  const client = hasServiceRole()
    ? createServiceClient()
    : await createClient();

  return {
    ok: true,
    user,
    workspaceId: active.workspace.id,
    client,
  };
}

export async function requirePluginContainer(
  pluginId: string,
): Promise<
  | (PluginAuthOk & {
      containerId: string;
      container: {
        id: string;
        workspace_id: string;
        name: string;
        platform: string;
        domain: string | null;
        published_version: number;
        draft_version: number;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      };
    })
  | PluginAuthErr
> {
  const auth = await requirePluginWorkspace();
  if (!auth.ok) return auth;

  const { data: container, error } = await auth.client
    .from("plugin_containers")
    .select(
      "id, workspace_id, name, platform, domain, published_version, draft_version, published_at, created_at, updated_at",
    )
    .eq("id", pluginId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (error || !container) {
    return { ok: false, status: 404, error: "Plugin not found" };
  }

  return {
    ...auth,
    containerId: container.id as string,
    container,
  };
}

export async function bumpPluginDraft(
  client: SupabaseClient | PluginAuthOk["client"],
  containerId: string,
) {
  const { data: row } = await client
    .from("plugin_containers")
    .select("draft_version, published_version")
    .eq("id", containerId)
    .maybeSingle();
  if (!row) return;

  const published = (row.published_version as number) ?? 0;
  const draft = (row.draft_version as number) ?? 1;
  const nextDraft = draft <= published ? published + 1 : draft;

  await client
    .from("plugin_containers")
    .update({
      draft_version: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", containerId);
}

export const PLUGIN_CONTAINER_SELECT =
  "id, workspace_id, name, platform, domain, published_version, draft_version, published_at, created_at, updated_at";
