import { NextResponse } from "next/server";
import { z } from "zod";
import type { Insight } from "@/domain";
import { isApplyDeliverableAction } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { executeInsightAction } from "@/lib/insights/execute-action";
import { getInsightRepository } from "@/repositories";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["accept", "reject", "revise", "do_it"]),
  feedback: z.string().trim().max(2000).optional(),
});

function revisePrompt(insight: Insight, feedback?: string): string {
  const notes = feedback?.trim();
  const base = `Revise insight "${insight.title}" (id ${insight.id}).`;
  if (notes) {
    return `${base}\n\nFeedback: ${notes}\n\nWhen ready, call resubmit_insight with this insightId.`;
  }
  return `${base}\n\nTell me what to change, then call resubmit_insight with this insightId.`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await context.params;
  const insights = await getInsightRepository();
  const insight = await insights.getById(id);
  if (!insight || insight.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ insight });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const insights = await getInsightRepository();
  const existing = await insights.getById(id);
  if (!existing || existing.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { action, feedback } = parsed.data;
  const plan = active.workspace.plan ?? "free";

  if (action === "reject") {
    if (
      existing.status !== "awaiting_review" &&
      existing.status !== "revising"
    ) {
      return NextResponse.json(
        { error: "Only reviewable insights can be rejected." },
        { status: 409 },
      );
    }
    const insight = await insights.update(id, {
      status: "rejected",
      activeJobId: null,
    });
    return NextResponse.json({ insight });
  }

  if (action === "revise") {
    if (existing.status !== "awaiting_review") {
      return NextResponse.json(
        { error: "Only awaiting-review insights can be revised." },
        { status: 409 },
      );
    }
    const insight = await insights.update(id, {
      status: "revising",
      revisionFeedback: feedback?.trim() || null,
    });
    return NextResponse.json({
      insight,
      revisePrompt: revisePrompt(insight, feedback),
    });
  }

  if (action === "accept") {
    if (existing.status !== "awaiting_review") {
      return NextResponse.json(
        { error: "Only awaiting-review insights can be accepted." },
        { status: 409 },
      );
    }
    const insight = await insights.update(id, {
      status: "accepted",
      activeJobId: null,
      revisionFeedback: null,
    });

    // Deliverables apply on Accept — no separate Do it step.
    if (isApplyDeliverableAction(insight.action)) {
      try {
        const result = await executeInsightAction({
          insight,
          workspaceId: active.workspace.id,
          userId: user.id,
          plan,
        });
        const refreshed = await insights.getById(id);
        return NextResponse.json({
          insight: refreshed ?? insight,
          result,
        });
      } catch (err) {
        // Roll status back so the user can retry.
        await insights.update(id, { status: "awaiting_review" });
        if (err instanceof PlanEntitlementError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.status },
          );
        }
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to apply deliverable.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ insight });
  }

  // do_it — require accepted first (non-deliverable actions)
  if (existing.status !== "accepted") {
    return NextResponse.json(
      { error: "Accept the insight before running its action." },
      { status: 409 },
    );
  }
  if (!existing.action) {
    return NextResponse.json(
      { error: "This insight has no actionable next step." },
      { status: 409 },
    );
  }
  if (isApplyDeliverableAction(existing.action)) {
    return NextResponse.json(
      { error: "Deliverable insights apply on Accept." },
      { status: 409 },
    );
  }

  try {
    const result = await executeInsightAction({
      insight: existing,
      workspaceId: active.workspace.id,
      userId: user.id,
      plan,
    });
    return NextResponse.json({ insight: existing, result });
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to execute action.",
      },
      { status: 500 },
    );
  }
}
