import type {
  Artifact,
  Insight,
  InsightAction,
  WorkspacePlan,
} from "@/domain";
import { artifactTypeSchema } from "@/domain";
import {
  PlanEntitlementError,
  assertCanCreateCreative,
} from "@/lib/billing/gates";
import { enqueueCreateCampaignJob } from "@/lib/jobs/enqueue";
import { startVideoCreative } from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import { getArtifactRepository } from "@/repositories";

export type InsightActionResult =
  | { type: "open_chat"; prefill: string }
  | { type: "create_campaign"; jobId: string }
  | { type: "create_video_creative"; creativeId: string; jobId: string }
  | { type: "propose_artifact"; artifactId: string };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function createArtifactFromInsight(opts: {
  productId: string;
  campaignId?: string | null;
  type: Artifact["type"];
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  userId: string;
  plan: WorkspacePlan;
}): Promise<Artifact> {
  const artifacts = await getArtifactRepository();

  if (opts.type === "ad_copy") {
    if (opts.campaignId) {
      const count = await artifacts.countCreativesByCampaign(opts.campaignId);
      assertCanCreateCreative(opts.plan, count);
    } else {
      assertCanCreateCreative(opts.plan, 0);
    }
  }

  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: `art_${crypto.randomUUID().slice(0, 8)}`,
    productId: opts.productId,
    campaignId: opts.campaignId ?? null,
    type: opts.type,
    status: "proposed",
    title: opts.title,
    summary: opts.summary,
    payload: opts.payload,
    createdBy: opts.userId,
    createdAt: now,
    updatedAt: now,
  };
  return artifacts.create(artifact);
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

  if (!hasServiceRole() && action.type !== "propose_artifact") {
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

  if (action.type === "propose_artifact") {
    const productId =
      asString(payload.productId) ?? opts.insight.productId ?? undefined;
    const title = asString(payload.title);
    const summary = asString(payload.summary) ?? opts.insight.summary;
    const typeParsed = artifactTypeSchema.safeParse(payload.type ?? "ad_copy");
    if (!productId || !title || !typeParsed.success) {
      throw new Error(
        "propose_artifact action requires productId, title, and type.",
      );
    }
    const innerPayload =
      payload.payload &&
      typeof payload.payload === "object" &&
      !Array.isArray(payload.payload)
        ? (payload.payload as Record<string, unknown>)
        : {};
    try {
      const artifact = await createArtifactFromInsight({
        productId,
        campaignId: asString(payload.campaignId) ?? opts.insight.campaignId,
        type: typeParsed.data,
        title,
        summary,
        payload: innerPayload,
        userId: opts.userId,
        plan: opts.plan,
      });
      return { type: "propose_artifact", artifactId: artifact.id };
    } catch (err) {
      if (err instanceof PlanEntitlementError) throw err;
      throw err;
    }
  }

  throw new Error(`Unsupported insight action: ${action.type}`);
}
