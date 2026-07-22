import { NextResponse } from "next/server";
import { z } from "zod";
import type { Artifact, ProductIntelligence } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { normalizeWorkspacePlan } from "@/lib/billing/entitlements";
import {
  assertCanLinkCreativesToCampaigns,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { getArtifactRepository, getProductRepository } from "@/repositories";

const patchSchema = z.union([
  z.object({
    action: z.enum(["approve", "reject", "update"]),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("set_campaigns"),
    campaignIds: z.array(z.string().min(1)),
  }),
]);

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

  if (parsed.data.action === "set_campaigns") {
    try {
      const active = await getActiveWorkspace();
      if (!active) {
        return NextResponse.json(
          { error: "No workspace available" },
          { status: 400 },
        );
      }

      const campaignIds = await resolveProductCampaignIds(
        existing.productId,
        parsed.data.campaignIds,
      );

      if (existing.type === "ad_copy") {
        await assertCanLinkCreativesToCampaigns({
          plan: normalizeWorkspacePlan(active.workspace.plan),
          campaignIds,
          countByCampaign: (cid) => artifacts.countCreativesByCampaign(cid),
          alreadyLinked: existing.campaignIds,
          kind: "ad_copy",
        });
      }

      await artifacts.setCampaignIds(id, campaignIds);
      const artifact = await artifacts.getById(id);
      return NextResponse.json({ artifact: artifact ?? existing });
    } catch (err) {
      if (err instanceof PlanEntitlementError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      logServerError("api.artifacts.set_campaigns", err, { artifactId: id });
      return NextResponse.json(
        { error: unknownErrorMessage(err, "Failed to update campaigns.") },
        { status: 500 },
      );
    }
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

    if (next.type === "listing_update") {
      const products = await getProductRepository();
      const product = await products.getProduct(next.productId);
      if (product) {
        const payload = next.payload;
        const title =
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : product.title;
        let description =
          typeof payload.description === "string"
            ? payload.description
            : product.description;
        if (Array.isArray(payload.bulletPoints) && payload.bulletPoints.length > 0) {
          const bullets = payload.bulletPoints
            .map(String)
            .map((b) => b.trim())
            .filter(Boolean);
          if (bullets.length > 0) {
            const bulletBlock = bullets.map((b) => `• ${b}`).join("\n");
            description = description.trim()
              ? `${description.trim()}\n\n${bulletBlock}`
              : bulletBlock;
          }
        }
        await products.updateProduct(next.productId, { title, description });
      }
    }
  }

  const saved = await artifacts.update(next);
  return NextResponse.json({ artifact: saved });
}
