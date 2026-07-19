import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Creative,
  CreativeStage,
  CreativeStatus,
  ScreenplayPayload,
  StoryboardPayload,
  VideoPayload,
} from "@/domain";
import {
  screenplayPayloadSchema,
  storyboardPayloadSchema,
  videoPayloadSchema,
} from "@/domain";

type DbCreative = {
  id: string;
  workspace_id: string;
  product_id: string;
  campaign_id: string | null;
  kind: Creative["kind"];
  title: string;
  brief: string;
  stage: CreativeStage;
  status: CreativeStatus;
  screenplay: unknown | null;
  storyboard: unknown | null;
  video: unknown | null;
  revision_feedback: string | null;
  active_job_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function parseScreenplay(value: unknown): ScreenplayPayload | null {
  if (value == null) return null;
  const parsed = screenplayPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseStoryboard(value: unknown): StoryboardPayload | null {
  if (value == null) return null;
  const parsed = storyboardPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseVideo(value: unknown): VideoPayload | null {
  if (value == null) return null;
  const parsed = videoPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function mapCreative(row: DbCreative): Creative {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    campaignId: row.campaign_id,
    kind: row.kind,
    title: row.title,
    brief: row.brief,
    stage: row.stage,
    status: row.status,
    screenplay: parseScreenplay(row.screenplay),
    storyboard: parseStoryboard(row.storyboard),
    video: parseVideo(row.video),
    revisionFeedback: row.revision_feedback,
    activeJobId: row.active_job_id,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreativeCreateInput = {
  id?: string;
  workspaceId: string;
  productId: string;
  campaignId?: string | null;
  kind?: Creative["kind"];
  title: string;
  brief: string;
  stage?: CreativeStage;
  status?: CreativeStatus;
  createdBy: string;
  activeJobId?: string | null;
};

export type CreativeUpdateInput = {
  title?: string;
  brief?: string;
  campaignId?: string | null;
  stage?: CreativeStage;
  status?: CreativeStatus;
  screenplay?: ScreenplayPayload | null;
  storyboard?: StoryboardPayload | null;
  video?: VideoPayload | null;
  revisionFeedback?: string | null;
  activeJobId?: string | null;
};

export class SupabaseCreativeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByWorkspace(
    workspaceId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Creative[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .from("creatives")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data as DbCreative[]).map(mapCreative);
  }

  async listByProduct(productId: string): Promise<Creative[]> {
    const { data, error } = await this.client
      .from("creatives")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as DbCreative[]).map(mapCreative);
  }

  async countByCampaign(campaignId: string): Promise<number> {
    const { count, error } = await this.client
      .from("creatives")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .neq("status", "rejected");
    if (error) throw error;
    return count ?? 0;
  }

  async getById(id: string): Promise<Creative | null> {
    const { data, error } = await this.client
      .from("creatives")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCreative(data as DbCreative) : null;
  }

  async create(input: CreativeCreateInput): Promise<Creative> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("creatives")
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        product_id: input.productId,
        campaign_id: input.campaignId ?? null,
        kind: input.kind ?? "video_ad",
        title: input.title,
        brief: input.brief,
        stage: input.stage ?? "screenplay",
        status: input.status ?? "generating",
        active_job_id: input.activeJobId ?? null,
        created_by: input.createdBy,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapCreative(data as DbCreative);
  }

  async update(id: string, patch: CreativeUpdateInput): Promise<Creative> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.brief !== undefined) row.brief = patch.brief;
    if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.screenplay !== undefined) row.screenplay = patch.screenplay;
    if (patch.storyboard !== undefined) row.storyboard = patch.storyboard;
    if (patch.video !== undefined) row.video = patch.video;
    if (patch.revisionFeedback !== undefined) {
      row.revision_feedback = patch.revisionFeedback;
    }
    if (patch.activeJobId !== undefined) {
      row.active_job_id = patch.activeJobId;
    }

    const { data, error } = await this.client
      .from("creatives")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapCreative(data as DbCreative);
  }
}
