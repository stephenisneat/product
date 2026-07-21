import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonError,
  requireGoogleAdsConnection,
} from "@/lib/channels/providers/google-ads/api-context";
import { customerResourceName } from "@/lib/channels/providers/google-ads";

type Params = {
  params: Promise<{ connectionId: string; campaignId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { connectionId, campaignId } = await params;
  const result = await requireGoogleAdsConnection(connectionId);
  if ("error" in result) return result.error;

  try {
    const campaign = await result.ctx.client.getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    return jsonError(error, "Failed to load campaign", 502);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  status: z.enum(["ENABLED", "PAUSED", "REMOVED"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dailyBudget: z.number().positive().optional(),
  budgetResourceName: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { connectionId, campaignId } = await params;
  const result = await requireGoogleAdsConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    return jsonError(error, "Invalid campaign patch", 400);
  }

  const resourceName = `${customerResourceName(result.ctx.connection.externalAccountId!)}/campaigns/${campaignId.replace(/\D/g, "")}`;

  try {
    if (
      body.name != null ||
      body.status != null ||
      body.startDate != null ||
      body.endDate != null
    ) {
      await result.ctx.client.updateCampaign(resourceName, {
        name: body.name,
        status: body.status,
        startDate: body.startDate,
        endDate: body.endDate,
      });
    }

    if (body.dailyBudget != null) {
      let budgetResourceName = body.budgetResourceName;
      if (!budgetResourceName) {
        const campaign = await result.ctx.client.getCampaign(campaignId);
        budgetResourceName = campaign?.campaignBudget;
      }
      if (!budgetResourceName) {
        return NextResponse.json(
          { error: "budgetResourceName is required to update daily budget" },
          { status: 400 },
        );
      }
      await result.ctx.client.updateCampaignBudget(
        budgetResourceName,
        body.dailyBudget,
      );
    }

    const campaign = await result.ctx.client.getCampaign(campaignId);
    return NextResponse.json({ campaign });
  } catch (error) {
    return jsonError(error, "Failed to update campaign", 502);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { connectionId, campaignId } = await params;
  const result = await requireGoogleAdsConnection(connectionId, {
    requireAdmin: true,
  });
  if ("error" in result) return result.error;

  const resourceName = `${customerResourceName(result.ctx.connection.externalAccountId!)}/campaigns/${campaignId.replace(/\D/g, "")}`;

  try {
    await result.ctx.client.updateCampaignStatus(resourceName, "REMOVED");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Failed to remove campaign", 502);
  }
}
