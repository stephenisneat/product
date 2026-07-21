import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

const searchSchema = z.object({
  query: z.string().min(1),
  pageSize: z.number().int().positive().max(10_000).optional(),
  pageToken: z.string().optional(),
});

/**
 * Run arbitrary GAQL — full read coverage of the Google Ads API.
 * POST { query, pageSize?, pageToken? }
 */
export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId);
  if ("error" in result) return result.error;

  let body: z.infer<typeof searchSchema>;
  try {
    body = searchSchema.parse(await request.json());
  } catch (error) {
    return jsonError(error, "Provide a GAQL query string", 400);
  }

  try {
    const page = await result.ctx.client.search(body.query, {
      pageSize: body.pageSize,
      pageToken: body.pageToken,
    });
    return NextResponse.json(page);
  } catch (error) {
    return jsonError(error, "GAQL search failed", 502);
  }
}
