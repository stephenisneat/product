import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { PlanEntitlementError } from "@/lib/billing/gates";
import { normalizeWorkspacePlan } from "@/lib/billing/entitlements";
import { assertCanLinkCreativesToCampaigns } from "@/lib/campaigns/associate";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import {
  createUploadedVideoCreative,
  prepareCreativeVideoUploads,
} from "@/lib/media/creative-upload";
import {
  validateCreativeVideoFile,
  validateCreativeVideoMeta,
} from "@/lib/media/creative-upload-shared";
import { hasServiceRole } from "@/lib/supabase/service";
import { getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const prepareSchema = z.object({
  action: z.literal("prepare"),
  videoContentType: z.string().min(1),
  videoSizeBytes: z.number().int().positive(),
  thumbnailContentType: z.string().min(1),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  creativeId: z.string().uuid(),
  productId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().max(4000).optional(),
  campaignIds: z.array(z.string().min(1)).optional(),
  campaignId: z.string().min(1).optional(),
  videoPath: z.string().min(1),
  thumbnailPath: z.string().min(1),
  durationSec: z.number().positive(),
  aspectRatio: z.string().trim().min(1).max(32),
});

const bodySchema = z.discriminatedUnion("action", [
  prepareSchema,
  completeSchema,
]);

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
      { error: "Storage service is not configured." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const plan = normalizeWorkspacePlan(active.workspace.plan);

  try {
    if (parsed.data.action === "prepare") {
      const fileError = validateCreativeVideoFile({
        contentType: parsed.data.videoContentType,
        sizeBytes: parsed.data.videoSizeBytes,
      });
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }

      // Fail fast on Free before the browser uploads large files.
      await assertCanLinkCreativesToCampaigns({
        plan,
        campaignIds: [],
        countByCampaign: async () => 0,
      });

      const targets = await prepareCreativeVideoUploads({
        workspaceId: active.workspace.id,
        videoContentType: parsed.data.videoContentType,
        thumbnailContentType: parsed.data.thumbnailContentType,
      });

      return NextResponse.json(targets);
    }

    const metaError = validateCreativeVideoMeta({
      durationSec: parsed.data.durationSec,
      aspectRatio: parsed.data.aspectRatio,
    });
    if (metaError) {
      return NextResponse.json({ error: metaError }, { status: 400 });
    }

    const products = await getProductRepository();
    const product = await products.getProduct(parsed.data.productId);
    if (!product || product.workspaceId !== active.workspace.id) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const creative = await createUploadedVideoCreative({
      workspaceId: active.workspace.id,
      productId: product.id,
      campaignIds: parsed.data.campaignIds,
      campaignId: parsed.data.campaignId,
      title: parsed.data.title,
      brief: parsed.data.brief,
      createdBy: user.id,
      plan,
      creativeId: parsed.data.creativeId,
      videoPath: parsed.data.videoPath,
      thumbnailPath: parsed.data.thumbnailPath,
      durationSec: parsed.data.durationSec,
      aspectRatio: parsed.data.aspectRatio,
      productTitle: product.title,
    });

    return NextResponse.json({ creative }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanEntitlementError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    logServerError("api.creatives.upload", err, {
      workspaceId: active.workspace.id,
      action: parsed.data.action,
    });
    return NextResponse.json(
      {
        error: unknownErrorMessage(err, "Failed to upload video ad."),
      },
      { status: 500 },
    );
  }
}
