import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsurePluginContainerResult = {
  created: boolean;
  id: string | null;
};

/** Find or create the single plugin container for a workspace. */
export async function ensurePluginContainer(
  client: SupabaseClient,
  workspaceId: string,
): Promise<EnsurePluginContainerResult> {
  const existing = await client
    .from("plugin_containers")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing.data?.id) {
    return { created: false, id: existing.data.id as string };
  }

  if (existing.error && existing.error.code !== "PGRST116") {
    console.warn(
      `[plugin/ensure-container] select failed for workspace ${workspaceId}:`,
      existing.error.message,
    );
  }

  const inserted = await client
    .from("plugin_containers")
    .insert({ workspace_id: workspaceId })
    .select("id")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const reread = await client
        .from("plugin_containers")
        .select("id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return { created: false, id: (reread.data?.id as string | null) ?? null };
    }
    console.warn(
      `[plugin/ensure-container] insert failed for workspace ${workspaceId}:`,
      inserted.error.message,
    );
    return { created: false, id: null };
  }

  return { created: true, id: inserted.data.id as string };
}
