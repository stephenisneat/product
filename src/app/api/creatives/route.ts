import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { startVideoCreative } from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import { getCreativeRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const createSchema = z.object({
  productId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(1).max(4000),
  campaignId: z.string().min(1).optional(),
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

  const creatives = await getCreativeRepository();
  const list = await creatives.listByWorkspace(active.workspace.id);
  return NextResponse.json({ creatives: list });
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

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const products = await getProductRepository();
  const product = await products.getProduct(parsed.data.productId);
  if (!product || product.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const { creative, job } = await startVideoCreative({
      workspaceId: active.workspace.id,
      productId: product.id,
      campaignId: parsed.data.campaignId ?? null,
      title: parsed.data.title,
      brief: parsed.data.brief,
      createdBy: user.id,
      trigger: "api",
      plan: active.workspace.plan ?? "free",
    });
    return NextResponse.json({ creative, jobId: job.id }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to start creative.",
      },
      { status: 500 },
    );
  }
}
