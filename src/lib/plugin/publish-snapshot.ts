import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishPluginSnapshotOpts = {
  notes?: string | null;
  publishedBy?: string | null;
  enabledTagsOnly?: boolean;
  workspaceId?: string;
};

export async function publishPluginContainerSnapshot(
  supabase: SupabaseClient,
  containerId: string,
  opts: PublishPluginSnapshotOpts = {},
): Promise<{ version: number }> {
  const enabledOnly = opts.enabledTagsOnly ?? true;

  let tagsQuery = supabase
    .from("plugin_container_tags")
    .select("*")
    .eq("container_id", containerId);
  if (enabledOnly) {
    tagsQuery = tagsQuery.eq("enabled", true);
  }

  const [{ data: allTags }, { data: allTriggers }, { data: allVariables }] =
    await Promise.all([
      tagsQuery,
      supabase
        .from("plugin_container_triggers")
        .select("*")
        .eq("container_id", containerId),
      supabase
        .from("plugin_container_variables")
        .select("*")
        .eq("container_id", containerId),
    ]);

  const snapshot = {
    ...(opts.workspaceId ? { workspace_id: opts.workspaceId } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: (allTags || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      config: t.config,
      trigger_ids: t.trigger_ids,
      priority: t.priority,
      enabled: t.enabled,
      consent_category: t.consent_category,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    triggers: (allTriggers || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      config: t.config,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    variables: (allVariables || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      config: v.config,
    })),
  };

  const { data: version, error: publishError } = await supabase.rpc(
    "publish_plugin_container_snapshot_version",
    {
      p_container_id: containerId,
      p_snapshot: snapshot,
      p_notes: opts.notes ?? null,
      p_published_by: opts.publishedBy ?? null,
    },
  );

  if (publishError) throw new Error(publishError.message);
  if (typeof version !== "number") {
    throw new Error("publish_plugin_container_snapshot_version returned no version");
  }

  return { version };
}
