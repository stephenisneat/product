import { NextResponse } from "next/server";
import { updateAdminFeedbackPromptSchema } from "@/domain";
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

/** Update the editable agent prompt before dispatch. */
export async function PATCH(req: Request, context: RouteContext) {
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateAdminFeedbackPromptSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
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
  if (row.status !== "prompt_ready" && row.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot edit prompt in status "${row.status}"` },
      { status: 409 },
    );
  }

  const { data: updated, error: updateError } = await service
    .from("admin_feedback")
    .update({
      approved_prompt: parsed.data.prompt,
      status: "prompt_ready",
      error_message: null,
    })
    .eq("id", id)
    .select(ADMIN_FEEDBACK_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || "Failed to update prompt" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    feedback: mapAdminFeedbackRow(updated as AdminFeedbackRow),
  });
}

/** Regenerate the agent prompt with AI (or template fallback). */
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
  if (
    row.status !== "prompt_ready" &&
    row.status !== "failed" &&
    row.status !== "pending"
  ) {
    return NextResponse.json(
      { error: `Cannot regenerate prompt in status "${row.status}"` },
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

  const { data: updated, error: updateError } = await service
    .from("admin_feedback")
    .update({
      status: "prompt_ready",
      generated_prompt: prompt,
      approved_prompt: prompt,
      error_message: null,
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
