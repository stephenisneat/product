import { NextResponse } from "next/server";
import { z } from "zod";
import {
  goalHorizonSchema,
  goalMetricSchema,
  goalScopeSchema,
} from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertHasInsights,
} from "@/lib/billing/gates";
import { getGoalRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const createSchema = z
  .object({
    scope: goalScopeSchema,
    productId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    metric: goalMetricSchema.optional(),
    targetValue: z.number().finite().nullable().optional(),
    targetUnit: z.string().trim().max(20).nullable().optional(),
    horizon: goalHorizonSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === "product" && !val.productId) {
      ctx.addIssue({
        code: "custom",
        message: "productId is required for product goals",
        path: ["productId"],
      });
    }
  });

export async function GET() {
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

  const goals = await getGoalRepository();
  const list = await goals.listByWorkspace(active.workspace.id);
  return NextResponse.json({ goals: list });
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

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.scope === "product" && parsed.data.productId) {
    const products = await getProductRepository();
    const product = await products.getProduct(parsed.data.productId);
    if (!product || product.workspaceId !== active.workspace.id) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
  }

  const goals = await getGoalRepository();
  const goal = await goals.create({
    workspaceId: active.workspace.id,
    scope: parsed.data.scope,
    productId: parsed.data.scope === "product" ? parsed.data.productId : null,
    title: parsed.data.title,
    metric: parsed.data.metric,
    targetValue: parsed.data.targetValue,
    targetUnit: parsed.data.targetUnit,
    horizon: parsed.data.horizon,
    notes: parsed.data.notes,
    createdBy: user.id,
    status: "active",
  });

  return NextResponse.json({ goal }, { status: 201 });
}
