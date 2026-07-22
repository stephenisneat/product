import type {
  DeliverableType,
  Insight,
  InsightAction,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import { deliverableTypeSchema, isApplyDeliverableAction } from "@/domain";
import { PlanEntitlementError } from "@/lib/billing/gates";
import {
  assertCanLinkCreativesToCampaigns,
  normalizeCampaignIds,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import { enqueueCreateCampaignJob } from "@/lib/jobs/enqueue";
import { startVideoCreative } from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import {
  getInsightRepository,
  getProductRepository,
} from "@/repositories";

export type InsightActionResult =
  | { type: "open_chat"; prefill: string }
  | { type: "create_campaign"; jobId: string }
  | { type: "create_video_creative"; creativeId: string; jobId: string }
  | { type: "apply_deliverable"; deliverableType: DeliverableType };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return ids.length > 0 ? ids : undefined;
}

function innerDeliverablePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (
    payload.payload &&
    typeof payload.payload === "object" &&
    !Array.isArray(payload.payload)
  ) {
    return payload.payload as Record<string, unknown>;
  }
  return {};
}

async function countAdCopyDeliverablesByCampaign(
  workspaceId: string,
  campaignId: string,
  excludeInsightId?: string,
): Promise<number> {
  const insights = await getInsightRepository();
  const rows = await insights.listByWorkspace(workspaceId, {
    status: ["accepted", "awaiting_review"],
    limit: 200,
  });
  let count = 0;
  for (const row of rows) {
    if (excludeInsightId && row.id === excludeInsightId) continue;
    if (!isApplyDeliverableAction(row.action)) continue;
    if (row.action.payload.type !== "ad_copy") continue;
    const ids = asStringArray(row.action.payload.campaignIds) ?? [];
    if (ids.includes(campaignId)) count += 1;
  }
  return count;
}

async function applyDeliverable(opts: {
  insight: Insight;
  workspaceId: string;
  plan: WorkspacePlan;
}): Promise<InsightActionResult> {
  const action = opts.insight.action as InsightAction;
  const payload = action.payload ?? {};
  const productId =
    asString(payload.productId) ?? opts.insight.productId ?? undefined;
  const typeParsed = deliverableTypeSchema.safeParse(
    payload.type ?? "ad_copy",
  );
  if (!productId || !typeParsed.success) {
    throw new Error(
      "apply_deliverable action requires productId and type.",
    );
  }
  const deliverableType = typeParsed.data;
  const body = innerDeliverablePayload(payload);
  const now = new Date().toISOString();

  const campaignIds = await resolveProductCampaignIds(
    productId,
    normalizeCampaignIds({
      campaignIds: asStringArray(payload.campaignIds),
      campaignId: asString(payload.campaignId) ?? opts.insight.campaignId,
    }),
  );

  if (deliverableType === "ad_copy") {
    await assertCanLinkCreativesToCampaigns({
      plan: opts.plan,
      campaignIds,
      countByCampaign: (id) =>
        countAdCopyDeliverablesByCampaign(
          opts.workspaceId,
          id,
          opts.insight.id,
        ),
      kind: "ad_copy",
    });
  }

  // Persist resolved campaign ids onto the action for Run-stream linking.
  if (campaignIds.length > 0 || asStringArray(payload.campaignIds)) {
    const insights = await getInsightRepository();
    await insights.update(opts.insight.id, {
      action: {
        ...action,
        payload: {
          ...payload,
          productId,
          type: deliverableType,
          campaignIds,
          payload: body,
        },
      },
    });
  }

  const products = await getProductRepository();

  if (deliverableType === "positioning") {
    const intelligence: ProductIntelligence = {
      productId,
      positioning: String(body.positioning ?? ""),
      audience: String(body.audience ?? ""),
      valueProps: Array.isArray(body.valueProps)
        ? body.valueProps.map(String)
        : [],
      objections: Array.isArray(body.objections)
        ? body.objections.map(String)
        : [],
      tone: String(body.tone ?? ""),
      updatedAt: now,
    };
    await products.upsertIntelligence(intelligence);
  }

  if (deliverableType === "listing_update") {
    const product = await products.getProduct(productId);
    if (product) {
      const title =
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : product.title;
      let description =
        typeof body.description === "string"
          ? body.description
          : product.description;
      if (Array.isArray(body.bulletPoints) && body.bulletPoints.length > 0) {
        const bullets = body.bulletPoints
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
      await products.updateProduct(productId, { title, description });
    }
  }

  return { type: "apply_deliverable", deliverableType };
}

export async function executeInsightAction(opts: {
  insight: Insight;
  workspaceId: string;
  userId: string;
  plan: WorkspacePlan;
}): Promise<InsightActionResult> {
  const action = opts.insight.action as InsightAction;
  const payload = action.payload ?? {};

  if (action.type === "open_chat") {
    const prefill =
      asString(payload.prefill) ??
      `Follow up on insight "${opts.insight.title}" (${opts.insight.id}).`;
    return { type: "open_chat", prefill };
  }

  if (action.type === "apply_deliverable") {
    try {
      return await applyDeliverable(opts);
    } catch (err) {
      if (err instanceof PlanEntitlementError) throw err;
      throw err;
    }
  }

  if (!hasServiceRole()) {
    throw new Error("Jobs service is not configured.");
  }

  if (action.type === "create_campaign") {
    const productId =
      asString(payload.productId) ?? opts.insight.productId ?? undefined;
    const name = asString(payload.name);
    if (!productId || !name) {
      throw new Error("create_campaign action requires productId and name.");
    }
    const job = await enqueueCreateCampaignJob({
      workspaceId: opts.workspaceId,
      createdBy: opts.userId,
      trigger: "api",
      input: {
        productId,
        name,
        objective: asString(payload.objective),
        channels: Array.isArray(payload.channels)
          ? payload.channels.filter(
              (c): c is string => typeof c === "string" && c.trim().length > 0,
            )
          : undefined,
      },
    });
    return { type: "create_campaign", jobId: job.id };
  }

  if (action.type === "create_video_creative") {
    const productId =
      asString(payload.productId) ?? opts.insight.productId ?? undefined;
    const title = asString(payload.title);
    const brief = asString(payload.brief);
    if (!productId || !title || !brief) {
      throw new Error(
        "create_video_creative action requires productId, title, and brief.",
      );
    }
    const { creative, job } = await startVideoCreative({
      workspaceId: opts.workspaceId,
      productId,
      campaignIds: asStringArray(payload.campaignIds),
      campaignId: asString(payload.campaignId) ?? opts.insight.campaignId,
      title,
      brief,
      createdBy: opts.userId,
      trigger: "api",
      plan: opts.plan,
    });
    return {
      type: "create_video_creative",
      creativeId: creative.id,
      jobId: job.id,
    };
  }

  throw new Error(`Unsupported insight action: ${action.type}`);
}
