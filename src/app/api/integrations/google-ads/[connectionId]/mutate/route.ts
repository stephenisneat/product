import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";

type Params = { params: Promise<{ connectionId: string }> };

const mutateSchema = z.object({
  /** Resource path segment, e.g. "campaigns", "adGroups", "campaignBudgets". */
  resource: z.string().min(1).optional(),
  operations: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Prefer googleAds:mutate for atomic multi-resource ops. */
  mutateOperations: z.array(z.record(z.string(), z.unknown())).optional(),
  partialFailure: z.boolean().optional(),
  validateOnly: z.boolean().optional(),
});

/**
 * Generic mutate escape hatch — full write coverage of the Google Ads API.
 * Either:
 *   { resource: "campaigns", operations: [...] }
 * or:
 *   { mutateOperations: [...] }  // googleAds:mutate
 */
export async function POST(request: Request, { params }: Params) {
  const { connectionId } = await params;
  const result = await requireGoogleAdsConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;

  let body: z.infer<typeof mutateSchema>;
  try {
    body = mutateSchema.parse(await request.json());
  } catch (error) {
    return jsonError(error, "Invalid mutate payload", 400);
  }

  try {
    if (body.mutateOperations?.length) {
      const response = await result.ctx.client.mutateGoogleAds(
        body.mutateOperations,
        {
          partialFailure: body.partialFailure,
          validateOnly: body.validateOnly,
        },
      );
      return NextResponse.json(response);
    }

    if (body.resource && body.operations?.length) {
      const response = await result.ctx.client.mutate(
        body.resource,
        body.operations as {
          create?: Record<string, unknown>;
          update?: Record<string, unknown>;
          remove?: string;
          updateMask?: string;
        }[],
        {
          partialFailure: body.partialFailure,
          validateOnly: body.validateOnly,
        },
      );
      return NextResponse.json(response);
    }

    return NextResponse.json(
      {
        error:
          "Provide either mutateOperations[] or resource + operations[].",
      },
      { status: 400 },
    );
  } catch (error) {
    return jsonError(error, "Google Ads mutate failed", 502);
  }
}
