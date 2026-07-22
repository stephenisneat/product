import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { getCreativeRepository } from "@/repositories";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const syncSchema = z.object({
  connectionId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Sync creative-level performance from Google Ads using external_ad_refs. */
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await params;
  const creatives = await getCreativeRepository();
  const creative = await creatives.getById(id);
  if (!creative || creative.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assetId = creative.externalAdRefs.googleAssetId?.trim();
  if (!assetId) {
    return NextResponse.json(
      {
        error:
          "Set a Google asset / ad ID on this creative before syncing performance.",
      },
      { status: 400 },
    );
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide connectionId, startDate, and endDate (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const result = await requireGoogleAdsConnection(parsed.data.connectionId);
  if ("error" in result) return result.error;
  if (result.ctx.active.workspace.id !== active.workspace.id) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const rows = await result.ctx.client.getAssetPerformance({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      assetId,
    });

    const points = rows
      .filter((row) => row.date)
      .map((row) => ({
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.cost,
        conversions: row.conversions,
        revenue: row.conversionsValue,
      }));

    await creatives.upsertCreativePerformance(id, points);
    const performance = await creatives.getCreativePerformance(id);
    return NextResponse.json({ performance, synced: points.length });
  } catch (err) {
    logServerError("api.creatives.performance.sync", err, { creativeId: id });
    return jsonError(
      err,
      unknownErrorMessage(err, "Failed to sync performance"),
      502,
    );
  }
}
