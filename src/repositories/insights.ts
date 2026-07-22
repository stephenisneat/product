import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Insight,
  InsightAction,
  InsightKind,
  InsightStatus,
  InsightTriggerSource,
} from "@/domain";
import { insightActionSchema } from "@/domain";

type DbInsight = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  campaign_id: string | null;
  goal_id: string | null;
  title: string;
  summary: string;
  rationale: string;
  kind: InsightKind;
  status: InsightStatus;
  trigger_source: InsightTriggerSource;
  trigger_ref: Record<string, unknown> | null;
  action: unknown | null;
  revision_feedback: string | null;
  active_job_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function parseAction(value: unknown): InsightAction | null {
  if (value == null) return null;
  let candidate = value;
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "propose_artifact"
  ) {
    candidate = { ...(value as Record<string, unknown>), type: "apply_deliverable" };
  }
  const parsed = insightActionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function mapInsight(row: DbInsight): Insight {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    campaignId: row.campaign_id,
    goalId: row.goal_id,
    title: row.title ?? "",
    summary: row.summary ?? "",
    rationale: row.rationale ?? "",
    kind: row.kind ?? "idea",
    status: row.status,
    triggerSource: row.trigger_source,
    triggerRef: row.trigger_ref,
    action: parseAction(row.action),
    revisionFeedback: row.revision_feedback,
    activeJobId: row.active_job_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type InsightCreateInput = {
  id?: string;
  workspaceId: string;
  productId?: string | null;
  campaignId?: string | null;
  goalId?: string | null;
  title?: string;
  summary?: string;
  rationale?: string;
  kind?: InsightKind;
  status?: InsightStatus;
  triggerSource: InsightTriggerSource;
  triggerRef?: Record<string, unknown> | null;
  action?: InsightAction | null;
  revisionFeedback?: string | null;
  activeJobId?: string | null;
  createdBy?: string | null;
};

export type InsightUpdateInput = {
  productId?: string | null;
  campaignId?: string | null;
  goalId?: string | null;
  title?: string;
  summary?: string;
  rationale?: string;
  kind?: InsightKind;
  status?: InsightStatus;
  triggerRef?: Record<string, unknown> | null;
  action?: InsightAction | null;
  revisionFeedback?: string | null;
  activeJobId?: string | null;
};

export class SupabaseInsightRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByWorkspace(
    workspaceId: string,
    opts: {
      status?: InsightStatus | InsightStatus[];
      productId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Insight[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    let query = this.client
      .from("insights")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (opts.status) {
      if (Array.isArray(opts.status)) {
        query = query.in("status", opts.status);
      } else {
        query = query.eq("status", opts.status);
      }
    }
    if (opts.productId) {
      query = query.eq("product_id", opts.productId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as DbInsight[]).map(mapInsight);
  }

  async listByProduct(
    workspaceId: string,
    productId: string,
    opts: {
      status?: InsightStatus | InsightStatus[];
      limit?: number;
    } = {},
  ): Promise<Insight[]> {
    return this.listByWorkspace(workspaceId, {
      ...opts,
      productId,
      limit: opts.limit ?? 50,
    });
  }

  async countByWorkspace(
    workspaceId: string,
    status: InsightStatus,
  ): Promise<number> {
    const { count, error } = await this.client
      .from("insights")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", status);
    if (error) throw error;
    return count ?? 0;
  }

  async findBySourceJobId(
    workspaceId: string,
    sourceJobId: string,
  ): Promise<Insight | null> {
    const { data, error } = await this.client
      .from("insights")
      .select("*")
      .eq("workspace_id", workspaceId)
      .contains("trigger_ref", { jobId: sourceJobId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInsight(data as DbInsight) : null;
  }

  async latestCreatedAt(workspaceId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("insights")
      .select("created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.created_at ?? null;
  }

  async getById(id: string): Promise<Insight | null> {
    const { data, error } = await this.client
      .from("insights")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInsight(data as DbInsight) : null;
  }

  async create(input: InsightCreateInput): Promise<Insight> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("insights")
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        product_id: input.productId ?? null,
        campaign_id: input.campaignId ?? null,
        goal_id: input.goalId ?? null,
        title: input.title ?? "",
        summary: input.summary ?? "",
        rationale: input.rationale ?? "",
        kind: input.kind ?? "idea",
        status: input.status ?? "generating",
        trigger_source: input.triggerSource,
        trigger_ref: input.triggerRef ?? null,
        action: input.action ?? null,
        revision_feedback: input.revisionFeedback ?? null,
        active_job_id: input.activeJobId ?? null,
        created_by: input.createdBy ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapInsight(data as DbInsight);
  }

  async update(id: string, patch: InsightUpdateInput): Promise<Insight> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.productId !== undefined) row.product_id = patch.productId;
    if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
    if (patch.goalId !== undefined) row.goal_id = patch.goalId;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.summary !== undefined) row.summary = patch.summary;
    if (patch.rationale !== undefined) row.rationale = patch.rationale;
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.triggerRef !== undefined) row.trigger_ref = patch.triggerRef;
    if (patch.action !== undefined) row.action = patch.action;
    if (patch.revisionFeedback !== undefined) {
      row.revision_feedback = patch.revisionFeedback;
    }
    if (patch.activeJobId !== undefined) row.active_job_id = patch.activeJobId;

    const { data, error } = await this.client
      .from("insights")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapInsight(data as DbInsight);
  }
}
