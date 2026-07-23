import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { generateFeedbackAgentPrompt } from "@/lib/feedback/generate-prompt";
import {
  ADMIN_FEEDBACK_SELECT,
  mapAdminFeedbackRow,
  type AdminFeedbackRow,
} from "@/lib/feedback/map-row";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Approve feedback and generate a detailed Cursor agent prompt. */
export async function POST(_req: Request, context: RouteContext) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role is not configured" },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_feedback")
    .select(ADMIN_FEEDBACK_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const row = data as AdminFeedbackRow;
  if (row.status !== "pending" && row.status !== "failed") {
    return NextResponse.json(
      {
        error: `Cannot approve feedback in status "${row.status}"`,
      },
      { status: 409 },
    );
  }

  let prompt: string;
  try {
    prompt = await generateFeedbackAgentPrompt({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      screenshotUrl: row.screenshot_url,
      userEmail: row.user_email,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await service
    .from("admin_feedback")
    .update({
      status: "prompt_ready",
      generated_prompt: prompt,
      approved_prompt: prompt,
      approved_at: now,
      approved_by: auth.user.id,
      error_message: null,
      rejected_at: null,
      rejected_by: null,
    })
    .eq("id", id)
    .select(ADMIN_FEEDBACK_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || "Failed to save prompt" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    feedback: mapAdminFeedbackRow(updated as AdminFeedbackRow),
  });
}
