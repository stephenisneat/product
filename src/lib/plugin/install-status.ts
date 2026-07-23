import type { PluginInstallStatus, PluginPlatform } from "@/lib/plugin/types";

export async function loadPluginInstallStatus(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  pluginId: string;
  domain: string | null;
  platform: PluginPlatform | string | null;
}): Promise<PluginInstallStatus> {
  const { client, pluginId, domain, platform } = input;
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: latest },
    { count: lastHourCount },
    { count: lastDayCount },
  ] = await Promise.all([
    client
      .from("plugin_measurement_events")
      .select("created_at, event_type, event_name")
      .eq("plugin_id", pluginId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("plugin_measurement_events")
      .select("*", { count: "exact", head: true })
      .eq("plugin_id", pluginId)
      .gte("created_at", hourAgo),
    client
      .from("plugin_measurement_events")
      .select("*", { count: "exact", head: true })
      .eq("plugin_id", pluginId)
      .gte("created_at", dayAgo),
  ]);

  return {
    has_ever_received: !!latest,
    last_event_at: latest?.created_at ?? null,
    last_event_type: latest?.event_type ?? null,
    last_event_name: latest?.event_name ?? null,
    last_hour_count: lastHourCount ?? 0,
    last_day_count: lastDayCount ?? 0,
    domain,
    platform,
  };
}
