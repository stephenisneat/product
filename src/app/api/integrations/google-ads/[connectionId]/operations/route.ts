import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

const keywordSchema = z.object({
  adGroupResourceName: z.string().min(1),
  keywords: z
    .array(
      z.object({
        text: z.string().min(1),
        matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
      }),
    )
    .min(1),
});

const adSchema = z.object({
  adGroupResourceName: z.string().min(1),
  status: z.enum(["ENABLED", "PAUSED"]).optional(),
  responsiveSearchAd: z
    .object({
      headlines: z.array(z.string().min(1)).min(3).max(15),
      descriptions: z.array(z.string().min(1)).min(2).max(4),
      path1: z.string().optional(),
      path2: z.string().optional(),
      finalUrls: z.array(z.string().url()).min(1),
    })
    .optional(),
  responsiveDisplayAd: z
    .object({
      headlines: z.array(z.string().min(1)).min(1).max(5),
      longHeadline: z.string().min(1),
      descriptions: z.array(z.string().min(1)).min(1).max(5),
      businessName: z.string().min(1),
      marketingImageAsset: z.string().min(1),
      squareMarketingImageAsset: z.string().optional(),
      finalUrls: z.array(z.string().url()).min(1),
    })
    .optional(),
  videoAd: z
    .object({
      videoAsset: z.string().min(1),
      adType: z.enum([
        "IN_STREAM",
        "BUMPER",
        "OUT_STREAM",
        "NON_SKIPPABLE_IN_STREAM",
      ]),
      finalUrls: z.array(z.string().url()).min(1),
      actionButtonLabel: z.string().optional(),
      actionHeadline: z.string().optional(),
    })
    .optional(),
});

const statusSchema = z.object({
  resourceName: z.string().min(1),
  status: z.enum(["ENABLED", "PAUSED", "REMOVED"]),
  resource: z.enum(["adGroup", "adGroupAd", "campaign"]),
});

const assetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("IMAGE"),
    name: z.string().min(1),
    dataBase64: z.string().min(1),
  }),
  z.object({
    type: z.literal("YOUTUBE_VIDEO"),
    name: z.string().min(1),
    youtubeVideoId: z.string().min(1),
  }),
]);

/**
 * Unified write surface for keywords, ads, assets, and status updates.
 * POST body: { action: "keywords" | "ads" | "status" | "assets", ... }
 */
export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;

  let raw: { action?: string } & Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = raw.action;
  try {
    switch (action) {
      case "keywords": {
        const body = keywordSchema.parse(raw);
        const response = await result.ctx.client.addKeywords(
          body.adGroupResourceName,
          body.keywords,
        );
        return NextResponse.json(response, { status: 201 });
      }
      case "ads": {
        const body = adSchema.parse(raw);
        const response = await result.ctx.client.createAdGroupAd(body);
        return NextResponse.json(response, { status: 201 });
      }
      case "status": {
        const body = statusSchema.parse(raw);
        if (body.resource === "adGroup") {
          await result.ctx.client.updateAdGroupStatus(
            body.resourceName,
            body.status,
          );
        } else if (body.resource === "adGroupAd") {
          await result.ctx.client.updateAdGroupAdStatus(
            body.resourceName,
            body.status,
          );
        } else {
          await result.ctx.client.updateCampaignStatus(
            body.resourceName,
            body.status,
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "assets": {
        const body = assetSchema.parse(raw);
        const response =
          body.type === "IMAGE"
            ? await result.ctx.client.createImageAsset({
                name: body.name,
                dataBase64: body.dataBase64,
              })
            : await result.ctx.client.createYoutubeVideoAsset({
                name: body.name,
                youtubeVideoId: body.youtubeVideoId,
              });
        return NextResponse.json(response, { status: 201 });
      }
      default:
        return NextResponse.json(
          {
            error:
              'Unknown action. Use "keywords", "ads", "status", or "assets".',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return jsonError(error, "Google Ads mutation failed", 502);
  }
}
