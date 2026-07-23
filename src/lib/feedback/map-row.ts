import type { AdminFeedback } from "@/domain";
import { sendFeedbackFulfilledEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/service";

export type AdminFeedbackRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  kind: string;
  title: string;
  body: string | null;
  screenshot_url: string | null;
  status: string;
  generated_prompt: string | null;
  approved_prompt: string | null;
  cursor_agent_id: string | null;
  cursor_agent_url: string | null;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  agent_summary: string | null;
  error_message: string | null;
  approved_at: string | null;
  approved_by: string | null;
  prompt_approved_at: string | null;
  prompt_approved_by: string | null;
  agent_launched_at: string | null;
  fulfilled_at: string | null;
  fulfillment_email_sent_at: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  created_at: string;
};

export const ADMIN_FEEDBACK_SELECT =
  "id, user_id, user_email, kind, title, body, screenshot_url, status, generated_prompt, approved_prompt, cursor_agent_id, cursor_agent_url, branch_name, pr_url, pr_number, agent_summary, error_message, approved_at, approved_by, prompt_approved_at, prompt_approved_by, agent_launched_at, fulfilled_at, fulfillment_email_sent_at, rejected_at, rejected_by, created_at";

export function mapAdminFeedbackRow(row: AdminFeedbackRow): AdminFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    kind: row.kind as AdminFeedback["kind"],
    title: row.title,
    body: row.body,
    screenshotUrl: row.screenshot_url,
    status: (row.status as AdminFeedback["status"]) || "pending",
    generatedPrompt: row.generated_prompt,
    approvedPrompt: row.approved_prompt,
    cursorAgentId: row.cursor_agent_id,
    cursorAgentUrl: row.cursor_agent_url,
    branchName: row.branch_name,
    prUrl: row.pr_url,
    prNumber: row.pr_number,
    agentSummary: row.agent_summary,
    errorMessage: row.error_message,
    approvedAt: row.approved_at,
    promptApprovedAt: row.prompt_approved_at,
    agentLaunchedAt: row.agent_launched_at,
    fulfilledAt: row.fulfilled_at,
    fulfillmentEmailSentAt: row.fulfillment_email_sent_at,
    rejectedAt: row.rejected_at,
    createdAt: row.created_at,
  };
}

export async function markFeedbackFulfilledAndNotify(input: {
  feedbackId?: string;
  prUrl?: string | null;
  prNumber?: number | null;
}): Promise<{ notified: boolean; feedbackId: string | null }> {
  const service = createServiceClient();

  let query = service
    .from("admin_feedback")
    .select(ADMIN_FEEDBACK_SELECT)
    .limit(1);

  if (input.feedbackId) {
    query = query.eq("id", input.feedbackId);
  } else if (input.prUrl) {
    query = query.eq("pr_url", input.prUrl);
  } else if (input.prNumber != null) {
    query = query.eq("pr_number", input.prNumber);
  } else {
    return { notified: false, feedbackId: null };
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return { notified: false, feedbackId: null };
  }

  const row = data as AdminFeedbackRow;
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await service
    .from("admin_feedback")
    .update({
      status: "fulfilled",
      fulfilled_at: row.fulfilled_at ?? now,
      pr_url: input.prUrl ?? row.pr_url,
      pr_number: input.prNumber ?? row.pr_number,
      error_message: null,
    })
    .eq("id", row.id)
    .select(ADMIN_FEEDBACK_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[feedback] fulfill update failed", updateError);
    return { notified: false, feedbackId: row.id };
  }

  const fulfilled = updated as AdminFeedbackRow;
  if (fulfilled.fulfillment_email_sent_at) {
    return { notified: false, feedbackId: fulfilled.id };
  }

  const to = fulfilled.user_email?.trim();
  if (!to) {
    return { notified: false, feedbackId: fulfilled.id };
  }

  try {
    await sendFeedbackFulfilledEmail({
      to,
      title: fulfilled.title,
      kind: fulfilled.kind,
      prUrl: fulfilled.pr_url,
    });
    await service
      .from("admin_feedback")
      .update({ fulfillment_email_sent_at: now })
      .eq("id", fulfilled.id);
    return { notified: true, feedbackId: fulfilled.id };
  } catch (err) {
    console.error("[feedback] fulfillment email failed", err);
    return { notified: false, feedbackId: fulfilled.id };
  }
}
