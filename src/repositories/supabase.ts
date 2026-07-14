import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";
import { buildPerformanceSeries } from "@/lib/demo/seed";
import type { ArtifactRepository, ProductRepository } from "./types";

type DbProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  status: Product["status"];
  price: number;
  currency: string;
  images: string[];
  channels: string[];
  sku: string | null;
  category: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
};

function mapProduct(row: DbProduct): Product {
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description,
    status: row.status,
    price: Number(row.price),
    currency: row.currency,
    images: row.images ?? [],
    channels: row.channels ?? [],
    sku: row.sku ?? undefined,
    category: row.category ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
  };
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listProducts(ownerId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("owner_id", ownerId)
      .order("title");
    if (error) throw error;
    return (data as DbProduct[]).map(mapProduct);
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data as DbProduct) : null;
  }

  async getIntelligence(productId: string): Promise<ProductIntelligence | null> {
    const { data, error } = await this.client
      .from("product_intelligence")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      productId: data.product_id,
      positioning: data.positioning,
      audience: data.audience,
      valueProps: data.value_props ?? [],
      objections: data.objections ?? [],
      tone: data.tone,
      updatedAt: data.updated_at,
    };
  }

  async upsertIntelligence(
    intelligence: ProductIntelligence,
  ): Promise<ProductIntelligence> {
    const { error } = await this.client.from("product_intelligence").upsert({
      product_id: intelligence.productId,
      positioning: intelligence.positioning,
      audience: intelligence.audience,
      value_props: intelligence.valueProps,
      objections: intelligence.objections,
      tone: intelligence.tone,
      updated_at: intelligence.updatedAt,
    });
    if (error) throw error;
    return intelligence;
  }

  async listCampaigns(productId: string): Promise<Campaign[]> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      status: row.status,
      channels: row.channels ?? [],
      objective: row.objective,
      updatedAt: row.updated_at,
    }));
  }

  async getPerformance(productId: string): Promise<PerformancePoint[]> {
    // Live analytics ingestion is out of milestone scope; keep a consistent demo series.
    return buildPerformanceSeries(productId);
  }
}

export class SupabaseArtifactRepository implements ArtifactRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByProduct(productId: string): Promise<Artifact[]> {
    const { data, error } = await this.client
      .from("artifacts")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      type: row.type,
      status: row.status,
      title: row.title,
      summary: row.summary,
      payload: row.payload ?? {},
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getById(id: string): Promise<Artifact | null> {
    const { data, error } = await this.client
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      productId: data.product_id,
      type: data.type,
      status: data.status,
      title: data.title,
      summary: data.summary,
      payload: data.payload ?? {},
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async create(artifact: Artifact): Promise<Artifact> {
    const { error } = await this.client.from("artifacts").insert({
      id: artifact.id,
      product_id: artifact.productId,
      type: artifact.type,
      status: artifact.status,
      title: artifact.title,
      summary: artifact.summary,
      payload: artifact.payload,
      created_by: artifact.createdBy,
      created_at: artifact.createdAt,
      updated_at: artifact.updatedAt,
    });
    if (error) throw error;
    return artifact;
  }

  async update(artifact: Artifact): Promise<Artifact> {
    const { error } = await this.client
      .from("artifacts")
      .update({
        status: artifact.status,
        title: artifact.title,
        summary: artifact.summary,
        payload: artifact.payload,
        updated_at: artifact.updatedAt,
      })
      .eq("id", artifact.id);
    if (error) throw error;
    return artifact;
  }
}
