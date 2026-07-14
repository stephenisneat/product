import { NextResponse } from "next/server";
import { z } from "zod";
import type { Artifact, ProductIntelligence } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getArtifactRepository, getProductRepository } from "@/repositories";

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "update"]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const artifacts = await getArtifactRepository();
  const existing = await artifacts.getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let next: Artifact = {
    ...existing,
    updatedAt: now,
  };

  if (parsed.data.payload) {
    next = { ...next, payload: parsed.data.payload };
  }

  if (parsed.data.action === "reject") {
    next = { ...next, status: "rejected" };
  }

  if (parsed.data.action === "approve") {
    next = { ...next, status: "approved" };

    if (next.type === "positioning") {
      const products = await getProductRepository();
      const payload = next.payload as Partial<ProductIntelligence>;
      const intelligence: ProductIntelligence = {
        productId: next.productId,
        positioning: String(payload.positioning ?? ""),
        audience: String(payload.audience ?? ""),
        valueProps: Array.isArray(payload.valueProps)
          ? payload.valueProps.map(String)
          : [],
        objections: Array.isArray(payload.objections)
          ? payload.objections.map(String)
          : [],
        tone: String(payload.tone ?? ""),
        updatedAt: now,
      };
      await products.upsertIntelligence(intelligence);
    }
  }

  const saved = await artifacts.update(next);
  return NextResponse.json({ artifact: saved });
}
