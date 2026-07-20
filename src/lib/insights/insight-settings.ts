import {
  DEFAULT_INSIGHT_SETTINGS,
  type InsightSettings,
} from "@/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

type InsightSettingsRow = {
  goal_mode: InsightSettings["goalMode"];
  trigger_job: boolean;
  trigger_agent: boolean;
  trigger_heartbeat: boolean;
  trigger_api: boolean;
  heartbeat_schedule: InsightSettings["heartbeatSchedule"];
};

export function rowToInsightSettings(row: InsightSettingsRow): InsightSettings {
  return {
    goalMode: row.goal_mode,
    triggers: {
      job: row.trigger_job,
      agent: row.trigger_agent,
      heartbeat: row.trigger_heartbeat,
      api: row.trigger_api,
    },
    heartbeatSchedule: row.heartbeat_schedule,
  };
}

export function insightSettingsToRow(settings: InsightSettings) {
  return {
    goal_mode: settings.goalMode,
    trigger_job: settings.triggers.job,
    trigger_agent: settings.triggers.agent,
    trigger_heartbeat: settings.triggers.heartbeat,
    trigger_api: settings.triggers.api,
    heartbeat_schedule: settings.heartbeatSchedule,
    updated_at: new Date().toISOString(),
  };
}

const SELECT_COLS =
  "goal_mode, trigger_job, trigger_agent, trigger_heartbeat, trigger_api, heartbeat_schedule";

export async function getInsightSettingsForWorkspace(
  client: SupabaseClient,
  workspaceId: string,
): Promise<InsightSettings> {
  const { data, error } = await client
    .from("workspace_insight_settings")
    .select(SELECT_COLS)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_INSIGHT_SETTINGS;
  return rowToInsightSettings(data as InsightSettingsRow);
}

export async function upsertInsightSettingsForWorkspace(
  client: SupabaseClient,
  workspaceId: string,
  settings: InsightSettings,
): Promise<InsightSettings> {
  const { data, error } = await client
    .from("workspace_insight_settings")
    .upsert(
      {
        workspace_id: workspaceId,
        ...insightSettingsToRow(settings),
      },
      { onConflict: "workspace_id" },
    )
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return rowToInsightSettings(data as InsightSettingsRow);
}
