import { NextResponse } from "next/server";
import { z } from "zod";
import { insightStatusSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertHasInsights,
} from "@/lib/billing/gates";
import { startInsightGeneration } from "@/lib/jobs/enqueue-insight";
import { hasServiceRole } from "@/lib/supabase/service";
import { getInsightRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const createSchema = z.object({
  productId: z.string().min(1).optional(),
  goalId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  let statusFilter: z.infer<typeof insightStatusSchema> | undefined;
  if (statusParam && statusParam !== "all") {
    const parsed = insightStatusSchema.safeParse(statusParam);
    if (parsed.success) statusFilter = parsed.data;
  }

  const insights = await getInsightRepository();
  const list = await insights.listByWorkspace(active.workspace.id, {
    status: statusFilter,
  });
  return NextResponse.json({ insights: list });
}

export async function POST(req: Request) {
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

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.productId) {
    const products = await getProductRepository();
    const product = await products.getProduct(parsed.data.productId);
    if (!product || product.workspaceId !== active.workspace.id) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
  }

  try {
    const { insight, job } = await startInsightGeneration({
      workspaceId: active.workspace.id,
      productId: parsed.data.productId ?? null,
      goalId: parsed.data.goalId ?? null,
      createdBy: user.id,
      insightTrigger: "api",
      jobTrigger: "api",
    });
    return NextResponse.json(
      { insight, jobId: job.id },
      { status: 201 },
    );
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
          err instanceof Error ? err.message : "Failed to generate insight.",
      },
      { status: 500 },
    );
  }
}
