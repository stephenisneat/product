import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertCanCreateCampaign,
  assertCanSpendAndLaunch,
} from "@/lib/billing/gates";
import { getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  objective: z.string().trim().max(500).optional(),
  channels: z.array(z.string().trim().min(1)).max(20).optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { id: productId } = await params;
  const products = await getProductRepository();
  const product = await products.getProduct(productId);
  if (!product || product.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const campaigns = await products.listCampaigns(productId);
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id: productId } = await params;
  const products = await getProductRepository();
  const product = await products.getProduct(productId);
  if (!product || product.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = active.workspace.plan ?? "free";
  const status = parsed.data.status ?? "draft";

  try {
    if (status === "active") {
      assertCanSpendAndLaunch(plan);
    }
    const existing = await products.listCampaigns(productId);
    assertCanCreateCampaign(plan, existing.length);
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const now = new Date().toISOString();
  const campaign = await products.createCampaign({
    id: crypto.randomUUID(),
    productId,
    name: parsed.data.name,
    status,
    channels: parsed.data.channels ?? [],
    objective: parsed.data.objective ?? "",
    updatedAt: now,
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
