import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId);
  if ("error" in result) return result.error;

  const campaignId = new URL(request.url).searchParams.get("campaignId") ?? undefined;

  try {
    const adGroups = await result.ctx.client.listAdGroups(campaignId ?? undefined);
    return NextResponse.json({ adGroups });
  } catch (error) {
    return jsonError(error, "Failed to list ad groups", 502);
  }
}

const createSchema = z.object({
  campaignResourceName: z.string().min(1),
  name: z.string().min(1).max(256),
  status: z.enum(["ENABLED", "PAUSED"]).optional(),
  cpcBid: z.number().positive().optional(),
  type: z.string().optional(),
});

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
    return jsonError(error, "Invalid ad group payload", 400);
  }

  try {
    const response = await result.ctx.client.createAdGroup(body);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create ad group", 502);
  }
}
