import { NextResponse } from "next/server";
import {
  getCursorWebhookSecret,
  parsePrNumber,
  verifyCursorWebhookSignature,
} from "@/lib/cursor/cloud-agents";
import {
  ADMIN_FEEDBACK_SELECT,
  type AdminFeedbackRow,
} from "@/lib/feedback/map-row";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";

export const runtime = "nodejs";

type CursorWebhookPayload = {
  event?: string;
  id?: string;
  status?: string;
  summary?: string;
  target?: {
    url?: string;
    branchName?: string;
    prUrl?: string;
  };
};

/**
 * Cursor Cloud Agent status webhooks (v0 launch-time webhook).
 * Events: statusChange → FINISHED | ERROR
 */
export async function POST(req: Request) {
  const secret = getCursorWebhookSecret();
  const rawBody = await req.text();

  if (secret) {
    const signature = req.headers.get("x-webhook-signature");
    if (!verifyCursorWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CURSOR_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  let payload: CursorWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CursorWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = payload.id?.trim();
  if (!agentId) {
    return NextResponse.json({ error: "Missing agent id" }, { status: 400 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role is not configured" },
      { status: 503 },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_feedback")
    .select(ADMIN_FEEDBACK_SELECT)
    .eq("cursor_agent_id", agentId)
    .maybeSingle();

  if (error) {
    console.error("[cursor webhook] lookup failed", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!data) {
    // Not a feedback-dispatched agent — acknowledge to stop retries.
    return NextResponse.json({ received: true, matched: false });
  }

  const row = data as AdminFeedbackRow;
  if (row.status === "fulfilled" || row.status === "rejected") {
    return NextResponse.json({ received: true, matched: true, skipped: true });
  }

  const status = (payload.status ?? "").toUpperCase();
  const prUrl = payload.target?.prUrl ?? row.pr_url;
  const branchName = payload.target?.branchName ?? row.branch_name;
  const agentUrl = payload.target?.url ?? row.cursor_agent_url;

  if (status === "ERROR") {
    await service
      .from("admin_feedback")
      .update({
        status: "failed",
        error_message: payload.summary?.trim() || "Cursor agent failed",
        agent_summary: payload.summary ?? row.agent_summary,
        cursor_agent_url: agentUrl,
        branch_name: branchName,
      })
      .eq("id", row.id);
    return NextResponse.json({ received: true, matched: true, status: "failed" });
  }

  if (status === "FINISHED") {
    await service
      .from("admin_feedback")
      .update({
        status: prUrl ? "pr_open" : "dispatched",
        pr_url: prUrl,
        pr_number: parsePrNumber(prUrl),
        branch_name: branchName,
        cursor_agent_url: agentUrl,
        agent_summary: payload.summary ?? row.agent_summary,
        error_message: null,
      })
      .eq("id", row.id);
    return NextResponse.json({
      received: true,
      matched: true,
      status: prUrl ? "pr_open" : "dispatched",
    });
  }

  return NextResponse.json({ received: true, matched: true, status });
}
