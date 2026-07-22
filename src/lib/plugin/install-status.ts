import { detectInstallPlatform } from "@/lib/plugin/detect-platform";
import type { PluginInstallStatus } from "@/lib/plugin/types";
import { getProductRepository } from "@/repositories";

export async function loadPluginInstallStatus(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  workspaceId: string;
  primaryDomain: string | null;
}): Promise<PluginInstallStatus> {
  const { client, workspaceId, primaryDomain } = input;
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const products = await getProductRepository();
  const [
    { data: latest },
    { count: lastHourCount },
    { count: lastDayCount },
    connections,
    productProvidersRes,
  ] = await Promise.all([
    client
      .from("plugin_measurement_events")
      .select("created_at, event_type, event_name")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("plugin_measurement_events")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", hourAgo),
    client
      .from("plugin_measurement_events")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", dayAgo),
    products.listConnections(workspaceId),
    client
      .from("products")
      .select("source_provider")
      .eq("workspace_id", workspaceId)
      .not("source_provider", "is", null)
      .limit(100),
  ]);

  const detected = detectInstallPlatform({
    connections,
    productProviders: (productProvidersRes.data ?? []).map(
      (row: { source_provider: string | null }) => row.source_provider,
    ),
  });

  return {
    has_ever_received: !!latest,
    last_event_at: latest?.created_at ?? null,
    last_event_type: latest?.event_type ?? null,
    last_event_name: latest?.event_name ?? null,
    last_hour_count: lastHourCount ?? 0,
    last_day_count: lastDayCount ?? 0,
    primary_domain: primaryDomain,
    detected_provider: detected,
  };
}
