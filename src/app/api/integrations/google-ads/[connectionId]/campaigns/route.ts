import { NextResponse } from "next/server";
import { z } from "zod";
import {
  googleAdsChannelTypeSchema,
} from "@/domain";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

/** List Search / Display / YouTube campaigns for a connected account. */
export async function GET(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId);
  if ("error" in result) return result.error;

  const { searchParams } = new URL(request.url);
  const channelTypes = searchParams.getAll("channelType");
  const statuses = searchParams.getAll("status");

  try {
    const campaigns = await result.ctx.client.listCampaigns({
      channelTypes: channelTypes.length
        ? channelTypes
        : ["SEARCH", "DISPLAY", "VIDEO"],
      statuses: statuses.length ? statuses : undefined,
    });
    return NextResponse.json({ campaigns });
  } catch (error) {
    return jsonError(error, "Failed to list campaigns", 502);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(256),
  channelType: googleAdsChannelTypeSchema,
  status: z.enum(["ENABLED", "PAUSED"]).optional(),
  dailyBudget: z.number().positive(),
  biddingStrategy: z
    .enum([
      "MANUAL_CPC",
      "MAXIMIZE_CLICKS",
      "MAXIMIZE_CONVERSIONS",
      "TARGET_CPA",
      "TARGET_ROAS",
      "TARGET_SPEND",
    ])
    .optional(),
  targetCpa: z.number().positive().optional(),
  targetRoas: z.number().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  networkSettings: z
    .object({
      targetGoogleSearch: z.boolean().optional(),
      targetSearchNetwork: z.boolean().optional(),
      targetContentNetwork: z.boolean().optional(),
      targetPartnerSearchNetwork: z.boolean().optional(),
    })
    .optional(),
  videoCampaignSubtype: z
    .enum(["VIDEO_ACTION", "VIDEO_REACH", "VIDEO_NON_SKIPPABLE"])
    .optional(),
});

/** Create a Search, Display, or YouTube campaign. */
export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    return jsonError(error, "Invalid campaign payload", 400);
  }

  try {
    const created = await result.ctx.client.createCampaign(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create campaign", 502);
  }
}
