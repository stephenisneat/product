import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AudioPayload,
  AudioScriptPayload,
  Creative,
  CreativeExternalAdRefs,
  CreativeStage,
  CreativeStatus,
  DisplayAssetsPayload,
  DisplayConceptPayload,
  ScreenplayPayload,
  SearchCopyPayload,
  SearchKeywordsPayload,
  StoryboardPayload,
  VideoPayload,
  WorldPayload,
} from "@/domain";
import {
  audioPayloadSchema,
  audioScriptPayloadSchema,
  creativeExternalAdRefsSchema,
  displayAssetsPayloadSchema,
  displayConceptPayloadSchema,
  screenplayPayloadSchema,
  searchCopyPayloadSchema,
  searchKeywordsPayloadSchema,
  storyboardPayloadSchema,
  videoPayloadSchema,
  worldPayloadSchema,
} from "@/domain";

type DbCreative = {
  id: string;
  workspace_id: string;
  product_id: string;
  kind: Creative["kind"];
  title: string;
  brief: string;
  stage: CreativeStage;
  status: CreativeStatus;
  screenplay: unknown | null;
  world: unknown | null;
  storyboard: unknown | null;
  video: unknown | null;
  concept: unknown | null;
  assets: unknown | null;
  copy: unknown | null;
  keywords: unknown | null;
  script: unknown | null;
  audio: unknown | null;
  revision_feedback: string | null;
  external_ad_refs: unknown | null;
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

function parseWorld(value: unknown): WorldPayload | null {
  if (value == null) return null;
  const parsed = worldPayloadSchema.safeParse(value);
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

function parseConcept(value: unknown): DisplayConceptPayload | null {
  if (value == null) return null;
  const parsed = displayConceptPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseAssets(value: unknown): DisplayAssetsPayload | null {
  if (value == null) return null;
  const parsed = displayAssetsPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseCopy(value: unknown): SearchCopyPayload | null {
  if (value == null) return null;
  const parsed = searchCopyPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseKeywords(value: unknown): SearchKeywordsPayload | null {
  if (value == null) return null;
  const parsed = searchKeywordsPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseScript(value: unknown): AudioScriptPayload | null {
  if (value == null) return null;
  const parsed = audioScriptPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseAudio(value: unknown): AudioPayload | null {
  if (value == null) return null;
  const parsed = audioPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseExternalAdRefs(value: unknown): CreativeExternalAdRefs {
  const parsed = creativeExternalAdRefsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function mapCreative(
  row: DbCreative,
  campaignIds: string[] = [],
): Creative {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    campaignIds,
    kind: row.kind,
    title: row.title,
    brief: row.brief,
    stage: row.stage,
    status: row.status,
    screenplay: parseScreenplay(row.screenplay),
    world: parseWorld(row.world),
    storyboard: parseStoryboard(row.storyboard),
    video: parseVideo(row.video),
    concept: parseConcept(row.concept),
    assets: parseAssets(row.assets),
    copy: parseCopy(row.copy),
    keywords: parseKeywords(row.keywords),
    script: parseScript(row.script),
    audio: parseAudio(row.audio),
    revisionFeedback: row.revision_feedback,
    externalAdRefs: parseExternalAdRefs(row.external_ad_refs),
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
  campaignIds?: string[];
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
  campaignIds?: string[];
  stage?: CreativeStage;
  status?: CreativeStatus;
  screenplay?: ScreenplayPayload | null;
  world?: WorldPayload | null;
  storyboard?: StoryboardPayload | null;
  video?: VideoPayload | null;
  concept?: DisplayConceptPayload | null;
  assets?: DisplayAssetsPayload | null;
  copy?: SearchCopyPayload | null;
  keywords?: SearchKeywordsPayload | null;
  script?: AudioScriptPayload | null;
  audio?: AudioPayload | null;
  revisionFeedback?: string | null;
  externalAdRefs?: CreativeExternalAdRefs;
  activeJobId?: string | null;
};

export class SupabaseCreativeRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async campaignIdsForCreatives(
    creativeIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (creativeIds.length === 0) return map;

    const { data, error } = await this.client
      .from("creative_campaigns")
      .select("creative_id, campaign_id")
      .in("creative_id", creativeIds);
    if (error) throw error;

    for (const row of data ?? []) {
      const creativeId = row.creative_id as string;
      const campaignId = row.campaign_id as string;
      const list = map.get(creativeId) ?? [];
      list.push(campaignId);
      map.set(creativeId, list);
    }
    return map;
  }

  private async attachCampaignIds(rows: DbCreative[]): Promise<Creative[]> {
    const byId = await this.campaignIdsForCreatives(rows.map((r) => r.id));
    return rows.map((row) => mapCreative(row, byId.get(row.id) ?? []));
  }

  private async replaceCampaignLinks(
    creativeId: string,
    campaignIds: string[],
  ): Promise<void> {
    const { error: delError } = await this.client
      .from("creative_campaigns")
      .delete()
      .eq("creative_id", creativeId);
    if (delError) throw delError;

    const unique = [...new Set(campaignIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return;

    const { error: insError } = await this.client
      .from("creative_campaigns")
      .insert(
        unique.map((campaign_id) => ({
          creative_id: creativeId,
          campaign_id,
        })),
      );
    if (insError) throw insError;
  }

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
    return this.attachCampaignIds((data ?? []) as DbCreative[]);
  }

  async listByProduct(productId: string): Promise<Creative[]> {
    const { data, error } = await this.client
      .from("creatives")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return this.attachCampaignIds((data ?? []) as DbCreative[]);
  }

  async listByCampaign(campaignId: string): Promise<Creative[]> {
    const { data: links, error: linkError } = await this.client
      .from("creative_campaigns")
      .select("creative_id")
      .eq("campaign_id", campaignId);
    if (linkError) throw linkError;

    const ids = (links ?? []).map((row) => row.creative_id as string);
    if (ids.length === 0) return [];

    const { data, error } = await this.client
      .from("creatives")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return this.attachCampaignIds((data ?? []) as DbCreative[]);
  }

  async countByCampaign(campaignId: string): Promise<number> {
    const { data: links, error: linkError } = await this.client
      .from("creative_campaigns")
      .select("creative_id")
      .eq("campaign_id", campaignId);
    if (linkError) throw linkError;

    const ids = (links ?? []).map((row) => row.creative_id as string);
    if (ids.length === 0) return 0;

    const { count, error } = await this.client
      .from("creatives")
      .select("id", { count: "exact", head: true })
      .in("id", ids)
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
    if (!data) return null;
    const [creative] = await this.attachCampaignIds([data as DbCreative]);
    return creative ?? null;
  }

  async create(input: CreativeCreateInput): Promise<Creative> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("creatives")
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        product_id: input.productId,
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

    const campaignIds = input.campaignIds ?? [];
    if (campaignIds.length > 0) {
      await this.replaceCampaignLinks(data.id as string, campaignIds);
    }
    const [creative] = await this.attachCampaignIds([data as DbCreative]);
    return creative!;
  }

  async update(id: string, patch: CreativeUpdateInput): Promise<Creative> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.brief !== undefined) row.brief = patch.brief;
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.screenplay !== undefined) row.screenplay = patch.screenplay;
    if (patch.world !== undefined) row.world = patch.world;
    if (patch.storyboard !== undefined) row.storyboard = patch.storyboard;
    if (patch.video !== undefined) row.video = patch.video;
    if (patch.concept !== undefined) row.concept = patch.concept;
    if (patch.assets !== undefined) row.assets = patch.assets;
    if (patch.copy !== undefined) row.copy = patch.copy;
    if (patch.keywords !== undefined) row.keywords = patch.keywords;
    if (patch.script !== undefined) row.script = patch.script;
    if (patch.audio !== undefined) row.audio = patch.audio;
    if (patch.revisionFeedback !== undefined) {
      row.revision_feedback = patch.revisionFeedback;
    }
    if (patch.externalAdRefs !== undefined) {
      row.external_ad_refs = patch.externalAdRefs;
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

    if (patch.campaignIds !== undefined) {
      await this.replaceCampaignLinks(id, patch.campaignIds);
    }

    const [creative] = await this.attachCampaignIds([data as DbCreative]);
    return creative!;
  }

  async delete(id: string): Promise<void> {
    const { error: linkError } = await this.client
      .from("creative_campaigns")
      .delete()
      .eq("creative_id", id);
    if (linkError) throw linkError;

    const { error } = await this.client.from("creatives").delete().eq("id", id);
    if (error) throw error;
  }

  async getCreativePerformance(
    creativeId: string,
  ): Promise<import("@/domain").PerformancePoint[]> {
    const { data, error } = await this.client
      .from("creative_performance_points")
      .select("date, impressions, clicks, spend, conversions, revenue")
      .eq("creative_id", creativeId)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      date: String(row.date),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? 0),
      conversions: Number(row.conversions ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async upsertCreativePerformance(
    creativeId: string,
    points: import("@/domain").PerformancePoint[],
  ): Promise<void> {
    if (points.length === 0) return;
    const { error } = await this.client
      .from("creative_performance_points")
      .upsert(
        points.map((p) => ({
          creative_id: creativeId,
          date: p.date,
          impressions: p.impressions,
          clicks: p.clicks,
          spend: p.spend,
          conversions: p.conversions,
          revenue: p.revenue,
        })),
        { onConflict: "creative_id,date" },
      );
    if (error) throw error;
  }
}
