import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

const reportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignId: z.string().optional(),
});

/** Campaign performance for Search / Display / YouTube. */
export async function GET(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId);
  if ("error" in result) return result.error;

  const { searchParams } = new URL(request.url);
  const parsed = reportSchema.safeParse({
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
    campaignId: searchParams.get("campaignId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide startDate and endDate as YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const rows = await result.ctx.client.getCampaignPerformance(parsed.data);
    return NextResponse.json({ rows });
  } catch (error) {
    return jsonError(error, "Failed to load performance", 502);
  }
}
