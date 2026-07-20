import { NextResponse } from "next/server";
import { z } from "zod";
import {
  goalHorizonSchema,
  goalMetricSchema,
  goalStatusSchema,
} from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertHasInsights,
} from "@/lib/billing/gates";
import { getGoalRepository } from "@/repositories";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  metric: goalMetricSchema.optional(),
  targetValue: z.number().finite().nullable().optional(),
  targetUnit: z.string().trim().max(20).nullable().optional(),
  horizon: goalHorizonSchema.optional(),
  status: goalStatusSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

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

  try {
    assertHasInsights(active.workspace.plan ?? "free");
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const goals = await getGoalRepository();
  const existing = await goals.getById(id);
  if (!existing || existing.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const goal = await goals.update(id, parsed.data);
  return NextResponse.json({ goal });
}

export async function DELETE(
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

  try {
    assertHasInsights(active.workspace.plan ?? "free");
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const { id } = await context.params;
  const goals = await getGoalRepository();
  const existing = await goals.getById(id);
  if (!existing || existing.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await goals.delete(id);
  return NextResponse.json({ ok: true });
}
