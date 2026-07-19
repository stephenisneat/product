import { NextResponse } from "next/server";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PrefsRow = {
  product_updates: boolean;
  job_completions: boolean;
  workspace_invites: boolean;
  billing_alerts: boolean;
  marketing: boolean;
};

function rowToPrefs(row: PrefsRow): NotificationPreferences {
  return {
    productUpdates: row.product_updates,
    jobCompletions: row.job_completions,
    workspaceInvites: row.workspace_invites,
    billingAlerts: row.billing_alerts,
    marketing: row.marketing,
  };
}

function prefsToRow(prefs: NotificationPreferences) {
  return {
    product_updates: prefs.productUpdates,
    job_completions: prefs.jobCompletions,
    workspace_invites: prefs.workspaceInvites,
    billing_alerts: prefs.billingAlerts,
    marketing: prefs.marketing,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "product_updates, job_completions, workspace_invites, billing_alerts, marketing",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences = data
    ? rowToPrefs(data as PrefsRow)
    : DEFAULT_NOTIFICATION_PREFERENCES;

  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = notificationPreferencesSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select(
      "product_updates, job_completions, workspace_invites, billing_alerts, marketing",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const current = existing
    ? rowToPrefs(existing as PrefsRow)
    : DEFAULT_NOTIFICATION_PREFERENCES;
  const next: NotificationPreferences = { ...current, ...parsed.data };

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        ...prefsToRow(next),
      },
      { onConflict: "user_id" },
    )
    .select(
      "product_updates, job_completions, workspace_invites, billing_alerts, marketing",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: rowToPrefs(data as PrefsRow),
  });
}
