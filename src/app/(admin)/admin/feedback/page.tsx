import { AdminFeedbackInbox } from "@/features/admin/admin-feedback-inbox";
import type { AdminFeedback } from "@/domain";
import {
  ADMIN_FEEDBACK_SELECT,
  mapAdminFeedbackRow,
  type AdminFeedbackRow,
} from "@/lib/feedback/map-row";
import { createClient } from "@/lib/supabase/server";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_feedback")
    .select(ADMIN_FEEDBACK_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  const items: AdminFeedback[] = ((data ?? []) as AdminFeedbackRow[]).map(
    mapAdminFeedbackRow,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Feedback
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve requests to generate an agent prompt, then launch a Cursor
          cloud agent that opens a PR into{" "}
          <code className="text-xs">dev</code>. Submitters are emailed when the
          PR merges.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load feedback: {error.message}
        </p>
      ) : (
        <AdminFeedbackInbox items={items} />
      )}
    </div>
  );
}
