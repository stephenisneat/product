import { NextResponse } from "next/server";
import { z } from "zod";
import { createCampaignJobInputSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { enqueueCreateCampaignJob } from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import { getJobRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const createBodySchema = z.object({
  type: z.literal("create_campaign"),
  input: createCampaignJobInputSchema,
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  const jobs = await getJobRepository();
  const runs = await jobs.listByWorkspace(active.workspace.id, {
    limit,
    offset,
  });
  return NextResponse.json({ jobs: runs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  const parsed = createBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const products = await getProductRepository();
  const product = await products.getProduct(parsed.data.input.productId);
  if (!product || product.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const job = await enqueueCreateCampaignJob({
      workspaceId: active.workspace.id,
      createdBy: user.id,
      trigger: "api",
      input: parsed.data.input,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to enqueue job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
