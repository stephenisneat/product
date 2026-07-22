import { createClient } from "@supabase/supabase-js";
import type { Creative } from "@/domain";
import { sendCreativeReviewEmail } from "@/lib/email/resend";
import { logServerError } from "@/lib/errors";
import { hasServiceRole } from "@/lib/supabase/service";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Email the creative creator when a stage lands in awaiting_review,
 * if their creativeReview (or legacy jobCompletions) preference is on.
 */
export async function notifyCreativeAwaitingReview(
  creative: Creative,
): Promise<void> {
  if (!creative.createdBy || !hasServiceRole()) return;
  if (!process.env.RESEND_API_KEY) return;

  const supabase = serviceClient();
  if (!supabase) return;

  try {
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("creative_review, job_completions")
      .eq("user_id", creative.createdBy)
      .maybeSingle();

    const creativeReview =
      prefs?.creative_review ?? prefs?.job_completions ?? true;
    if (creativeReview === false) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", creative.createdBy)
      .maybeSingle();

    const email = profile?.email as string | undefined;
    if (!email) return;

    await sendCreativeReviewEmail({
      to: email,
      creativeTitle: creative.title,
      stage: creative.stage,
      creativeUrl: `${appUrl()}/creatives/${creative.id}`,
    });
  } catch (err) {
    logServerError("notifyCreativeAwaitingReview", err, {
      creativeId: creative.id,
    });
  }
}
