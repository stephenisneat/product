/**
 * Cron / scheduled jobs.
 *
 * @see https://trigger.dev/docs/tasks/scheduled
 */

import { schedules } from "@trigger.dev/sdk";
import { getEntitlements } from "@/lib/billing/entitlements";
import { enqueueAdPerformanceSyncForAllConnections } from "@/lib/jobs/enqueue-ad-performance";
import { maybeEnqueueHeartbeatInsight } from "@/lib/jobs/enqueue-insight";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { normalizeWorkspacePlan } from "@/lib/billing/entitlements";

/** Daily heartbeat: enqueue at most one insight per Pro workspace (soft-capped). */
export const insightsHeartbeat = schedules.task({
  id: "insights-heartbeat",
  // Every day at 14:00 UTC
  cron: "0 14 * * *",
  run: async () => {
    if (!hasServiceRole()) {
      return { skipped: true, reason: "no_service_role" };
    }

    const client = createServiceClient();
    const { data, error } = await client
      .from("workspaces")
      .select("id, plan");
    if (error) throw error;

    const results: { workspaceId: string; insightId: string | null }[] = [];
    for (const row of data ?? []) {
      const id = row.id as string;
      const plan = normalizeWorkspacePlan(row.plan);
      if (!getEntitlements(plan).hasInsights) continue;

      const insight = await maybeEnqueueHeartbeatInsight({ workspaceId: id });
      results.push({ workspaceId: id, insightId: insight?.id ?? null });
    }

    return {
      workspaces: results.length,
      enqueued: results.filter((r) => r.insightId).length,
      results,
    };
  },
});

/** Daily ad performance sync: one job per active ad connection with a linked account. */
export const adPerformanceHeartbeat = schedules.task({
  id: "ad-performance-heartbeat",
  // Every day at 06:00 UTC
  cron: "0 6 * * *",
  run: async () => {
    if (!hasServiceRole()) {
      return { skipped: true, reason: "no_service_role" };
    }

    const result = await enqueueAdPerformanceSyncForAllConnections({
      trigger: "cron",
    });

    return {
      enqueued: result.enqueued,
      connectionIds: result.connectionIds,
    };
  },
});
