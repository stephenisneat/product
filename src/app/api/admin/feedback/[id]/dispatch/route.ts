import { NextResponse } from "next/server";
import { dispatchAdminFeedbackSchema } from "@/domain";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  buildFeedbackAgentBranchName,
  hasCursorCloudAgents,
  launchCursorCloudAgent,
  parsePrNumber,
} from "@/lib/cursor/cloud-agents";
import { wrapPromptForCloudAgent } from "@/lib/feedback/generate-prompt";
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

function appBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return url.replace(/\/$/, "");
}

/** Approve the prompt and launch a Cursor cloud agent (PR into base ref). */
export async function POST(req: Request, context: RouteContext) {
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
  if (!hasCursorCloudAgents()) {
    return NextResponse.json(
      {
        error:
          "CURSOR_API_KEY is not configured. Set it to dispatch cloud agents.",
      },
      { status: 503 },
    );
  }

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = dispatchAdminFeedbackSchema.safeParse(json);
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
      { error: `Cannot dispatch feedback in status "${row.status}"` },
      { status: 409 },
    );
  }

  const promptText = (
    parsed.data.prompt ??
    row.approved_prompt ??
    row.generated_prompt ??
    ""
  ).trim();
  if (!promptText) {
    return NextResponse.json(
      { error: "Prompt is empty. Approve feedback to generate one first." },
      { status: 400 },
    );
  }

  const baseUrl = appBaseUrl();
  const webhookUrl = baseUrl
    ? `${baseUrl}/api/webhooks/cursor/agent`
    : undefined;
  const branchName = buildFeedbackAgentBranchName(row.id);
  const agentPrompt = wrapPromptForCloudAgent({
    feedbackId: row.id,
    prompt: promptText,
  });

  let agent;
  try {
    agent = await launchCursorCloudAgent({
      prompt: agentPrompt,
      name: `Feedback: ${row.title}`.slice(0, 100),
      branchName,
      webhookUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to launch Cursor agent";
    await service
      .from("admin_feedback")
      .update({
        status: "failed",
        error_message: message,
        approved_prompt: promptText,
      })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date().toISOString();
  const prUrl = agent.target?.prUrl ?? null;
  const { data: updated, error: updateError } = await service
    .from("admin_feedback")
    .update({
      status: prUrl ? "pr_open" : "dispatched",
      approved_prompt: promptText,
      prompt_approved_at: now,
      prompt_approved_by: auth.user.id,
      agent_launched_at: now,
      cursor_agent_id: agent.id,
      cursor_agent_url: agent.target?.url ?? null,
      branch_name: agent.target?.branchName ?? branchName,
      pr_url: prUrl,
      pr_number: parsePrNumber(prUrl),
      error_message: null,
    })
    .eq("id", id)
    .select(ADMIN_FEEDBACK_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error:
          updateError?.message ||
          "Agent launched but failed to persist status",
        agentId: agent.id,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    feedback: mapAdminFeedbackRow(updated as AdminFeedbackRow),
    agent: {
      id: agent.id,
      url: agent.target?.url ?? null,
      branchName: agent.target?.branchName ?? branchName,
      status: agent.status,
    },
  });
}
