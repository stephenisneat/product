import { NextResponse } from "next/server";
import { z } from "zod";
import {
  insightGoalModeSchema,
  insightHeartbeatScheduleSchema,
  insightSettingsSchema,
  type InsightSettings,
} from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { assertHasInsights, PlanEntitlementError } from "@/lib/billing/gates";
import {
  getInsightSettingsForWorkspace,
  upsertInsightSettingsForWorkspace,
} from "@/lib/insights/insight-settings";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const patchSchema = z.object({
  goalMode: insightGoalModeSchema.optional(),
  triggers: z
    .object({
      job: z.boolean().optional(),
      agent: z.boolean().optional(),
      heartbeat: z.boolean().optional(),
      api: z.boolean().optional(),
    })
    .optional(),
  heartbeatSchedule: insightHeartbeatScheduleSchema.optional(),
});

function planErrorResponse(err: unknown) {
  if (err instanceof PlanEntitlementError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    assertHasInsights(active.workspace.plan ?? "free");
  } catch (err) {
    return planErrorResponse(err) ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  try {
    const settings = await getInsightSettingsForWorkspace(
      supabase,
      active.workspace.id,
    );
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (active.role !== "owner" && active.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    assertHasInsights(active.workspace.plan ?? "free");
  } catch (err) {
    return planErrorResponse(err) ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const current = await getInsightSettingsForWorkspace(
      supabase,
      active.workspace.id,
    );
    const next: InsightSettings = {
      goalMode: parsed.data.goalMode ?? current.goalMode,
      heartbeatSchedule:
        parsed.data.heartbeatSchedule ?? current.heartbeatSchedule,
      triggers: {
        ...current.triggers,
        ...parsed.data.triggers,
      },
    };

    const valid = insightSettingsSchema.safeParse(next);
    if (!valid.success) {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    }

    const settings = await upsertInsightSettingsForWorkspace(
      supabase,
      active.workspace.id,
      valid.data,
    );
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 500 },
    );
  }
}
