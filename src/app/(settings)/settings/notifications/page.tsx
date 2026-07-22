import { redirect } from "next/navigation";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/domain";
import { NotificationPreferencesPanel } from "@/features/settings/notification-preferences-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PrefsRow = {
  product_updates: boolean;
  job_completions: boolean;
  creative_review: boolean | null;
  workspace_invites: boolean;
  billing_alerts: boolean;
  marketing: boolean;
};

export default async function NotificationsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/notifications");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select(
      "product_updates, job_completions, creative_review, workspace_invites, billing_alerts, marketing",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const preferences: NotificationPreferences = data
    ? {
        productUpdates: (data as PrefsRow).product_updates,
        jobCompletions: (data as PrefsRow).job_completions,
        creativeReview:
          (data as PrefsRow).creative_review ??
          (data as PrefsRow).job_completions,
        workspaceInvites: (data as PrefsRow).workspace_invites,
        billingAlerts: (data as PrefsRow).billing_alerts,
        marketing: (data as PrefsRow).marketing,
      }
    : DEFAULT_NOTIFICATION_PREFERENCES;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which email notifications you want to receive.
        </p>
      </div>

      <NotificationPreferencesPanel initialPreferences={preferences} />
    </div>
  );
}
