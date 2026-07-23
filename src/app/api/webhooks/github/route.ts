import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { markFeedbackFulfilledAndNotify } from "@/lib/feedback/map-row";
import { hasServiceRole } from "@/lib/supabase/service";

export const runtime = "nodejs";

type GitHubPullRequestEvent = {
  action?: string;
  number?: number;
  pull_request?: {
    number?: number;
    html_url?: string;
    merged?: boolean;
    base?: { ref?: string };
    title?: string;
  };
  repository?: {
    html_url?: string;
    full_name?: string;
  };
};

function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length).trim();
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GitHub webhook: when a PR merges into the base branch, mark matching
 * feedback fulfilled and email the submitter.
 *
 * Configure: Pull request events → URL /api/webhooks/github
 * Secret: GITHUB_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  const rawBody = await req.text();

  if (secret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifyGitHubSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const event = req.headers.get("x-github-event");
  if (event === "ping") {
    return NextResponse.json({ ok: true });
  }
  if (event !== "pull_request") {
    return NextResponse.json({ received: true, ignored: true });
  }

  let payload: GitHubPullRequestEvent;
  try {
    payload = JSON.parse(rawBody) as GitHubPullRequestEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.action !== "closed") {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!payload.pull_request?.merged) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const baseRef =
    process.env.CURSOR_AGENT_BASE_REF?.trim() ||
    process.env.GITHUB_PR_BASE_REF?.trim() ||
    "dev";
  const prBase = payload.pull_request.base?.ref;
  if (prBase && prBase !== baseRef) {
    return NextResponse.json({
      received: true,
      ignored: true,
      reason: `base is ${prBase}, expected ${baseRef}`,
    });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role is not configured" },
      { status: 503 },
    );
  }

  const prUrl = payload.pull_request.html_url ?? null;
  const prNumber = payload.pull_request.number ?? payload.number ?? null;

  const result = await markFeedbackFulfilledAndNotify({
    prUrl,
    prNumber,
  });

  return NextResponse.json({
    received: true,
    feedbackId: result.feedbackId,
    notified: result.notified,
  });
}
