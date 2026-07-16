import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Artifact,
  Campaign,
  CanonicalProduct,
  Collection,
  CommerceConnection,
  CommerceProvider,
  PerformancePoint,
  Product,
  ProductIntelligence,
  ProductOption,
  ProductType,
  ProductVariant,
} from "@/domain";
import {
  brickAndMortarMetadataSchema,
  ecommerceMetadataSchema,
  electionMetadataSchema,
  eventMetadataSchema,
  mobileAppMetadataSchema,
  productTypeSchema,
  websiteMetadataSchema,
} from "@/domain";
import { buildPerformanceSeries } from "@/lib/performance/sample-series";
import {
  createCollectionId,
  createOptionId,
  createProductId,
  createVariantId,
} from "@/lib/products/slugify";
import type {
  ArtifactRepository,
  CommerceConnectionRecord,
  ProductRepository,
} from "./types";

type DbProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  status: Product["status"];
  type: string | null;
  metadata: unknown;
  price: number;
  currency: string;
  images: string[];
  image_avg_colors: string[];
  channels: string[];
  sku: string | null;
  category: string | null;
  source_provider: string | null;
  source_product_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

type DbVariant = {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  option_values: Record<string, string> | null;
  position: number;
  source_variant_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  inventory_levels?:
    | {
        variant_id: string;
        quantity: number;
        tracked: boolean;
        updated_at: string;
      }
    | {
        variant_id: string;
        quantity: number;
        tracked: boolean;
        updated_at: string;
      }[]
    | null;
};

type DbOption = {
  id: string;
  product_id: string;
  name: string;
  position: number;
};

type DbCollection = {
  id: string;
  workspace_id: string;
  title: string;
  handle: string;
  source_provider: string | null;
  source_collection_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbConnection = {
  id: string;
  workspace_id: string;
  provider: CommerceProvider;
  shop_domain: string;
  access_token: string;
  scope: string;
  status: CommerceConnection["status"];
  created_at: string;
  updated_at: string;
};

function mapProductType(value: string | null | undefined): ProductType {
  const parsed = productTypeSchema.safeParse(value ?? "ecommerce");
  return parsed.success ? parsed.data : "ecommerce";
}

function mapProductMetadata(
  type: ProductType,
  metadata: unknown,
): Product["metadata"] {
  switch (type) {
    case "ecommerce": {
      const parsed = ecommerceMetadataSchema.safeParse(metadata);
      return parsed.success
        ? parsed.data
        : { fulfillmentKind: "physical" };
    }
    case "mobile_app": {
      const parsed = mobileAppMetadataSchema.safeParse(metadata);
      return parsed.success ? parsed.data : { platforms: ["ios"] };
    }
    case "website": {
      const parsed = websiteMetadataSchema.safeParse(metadata);
      return parsed.success
        ? parsed.data
        : { url: "https://example.com" };
    }
    case "brick_and_mortar": {
      const parsed = brickAndMortarMetadataSchema.safeParse(metadata);
      return parsed.success
        ? parsed.data
        : {
            addressLine1: "Unknown",
            city: "Unknown",
            region: "Unknown",
            postalCode: "00000",
            country: "US",
          };
    }
    case "event": {
      const parsed = eventMetadataSchema.safeParse(metadata);
      return parsed.success
        ? parsed.data
        : { startAt: new Date(0).toISOString(), venue: "Unknown" };
    }
    case "election": {
      const parsed = electionMetadataSchema.safeParse(metadata);
      return parsed.success
        ? parsed.data
        : {
            electionDate: "1970-01-01",
            jurisdiction: "Unknown",
            office: "Unknown",
            candidateName: "Unknown",
          };
    }
  }
}

function mapProduct(row: DbProduct): Product {
  const type = mapProductType(row.type);
  const shared = {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description,
    status: row.status,
    price: Number(row.price),
    currency: row.currency,
    images: row.images ?? [],
    imageAvgColors: row.image_avg_colors ?? [],
    channels: row.channels ?? [],
    sku: row.sku ?? undefined,
    category: row.category ?? undefined,
    sourceProvider: (row.source_provider as Product["sourceProvider"]) ?? undefined,
    sourceProductId: row.source_product_id ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceId: row.workspace_id,
  };

  switch (type) {
    case "ecommerce":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "ecommerce" }
        >["metadata"],
      };
    case "mobile_app":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "mobile_app" }
        >["metadata"],
      };
    case "website":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "website" }
        >["metadata"],
      };
    case "brick_and_mortar":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "brick_and_mortar" }
        >["metadata"],
      };
    case "event":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "event" }
        >["metadata"],
      };
    case "election":
      return {
        ...shared,
        type,
        metadata: mapProductMetadata(type, row.metadata ?? {}) as Extract<
          Product,
          { type: "election" }
        >["metadata"],
      };
  }
}

function mapOption(row: DbOption): ProductOption {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    position: row.position,
  };
}

function mapVariant(row: DbVariant): ProductVariant {
  const inventoryRow = Array.isArray(row.inventory_levels)
    ? row.inventory_levels[0]
    : row.inventory_levels;
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    sku: row.sku ?? undefined,
    barcode: row.barcode ?? undefined,
    price: Number(row.price),
    compareAtPrice:
      row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    currency: row.currency,
    optionValues: row.option_values ?? {},
    position: row.position,
    sourceVariantId: row.source_variant_id ?? undefined,
    imageUrl: row.image_url ?? undefined,
    inventory: inventoryRow
      ? {
          variantId: inventoryRow.variant_id,
          quantity: inventoryRow.quantity,
          tracked: inventoryRow.tracked,
          updatedAt: inventoryRow.updated_at,
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCollection(row: DbCollection): Collection {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    handle: row.handle,
    sourceProvider:
      (row.source_provider as Collection["sourceProvider"]) ?? undefined,
    sourceCollectionId: row.source_collection_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnection(row: DbConnection): CommerceConnectionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    shopDomain: row.shop_domain,
    accessToken: row.access_token,
    scope: row.scope,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function denormalizeFromCanonical(canonical: CanonicalProduct) {
  const firstVariant = canonical.variants[0];
  const firstCollection = canonical.collections[0];
  return {
    price: firstVariant?.price ?? 0,
    currency: firstVariant?.currency ?? "USD",
    sku: firstVariant?.sku,
    category: firstCollection?.title,
  };
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listProducts(workspaceId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("workspace_id", workspaceId)
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
    if (!data) return null;

    const product = mapProduct(data as DbProduct);

    const [optionsRes, variantsRes, collectionsRes] = await Promise.all([
      this.client
        .from("product_options")
        .select("*")
        .eq("product_id", id)
        .order("position"),
      this.client
        .from("product_variants")
        .select("*, inventory_levels(*)")
        .eq("product_id", id)
        .order("position"),
      this.client
        .from("product_collections")
        .select("collections(*)")
        .eq("product_id", id),
    ]);

    if (optionsRes.error) throw optionsRes.error;
    if (variantsRes.error) throw variantsRes.error;
    if (collectionsRes.error) throw collectionsRes.error;

    product.options = ((optionsRes.data ?? []) as DbOption[]).map(mapOption);
    product.variants = ((variantsRes.data ?? []) as DbVariant[]).map(mapVariant);
    product.collections = (
      (collectionsRes.data ?? []) as unknown as {
        collections: DbCollection | null;
      }[]
    )
      .map((row) => row.collections)
      .filter((row): row is DbCollection => Boolean(row))
      .map(mapCollection);

    return product;
  }

  async createProduct(product: Product): Promise<Product> {
    const now = product.createdAt;
    const { error } = await this.client.from("products").insert({
      id: product.id,
      workspace_id: product.workspaceId,
      title: product.title,
      handle: product.handle,
      description: product.description,
      status: product.status,
      type: product.type,
      metadata: product.metadata,
      price: product.price,
      currency: product.currency,
      images: product.images,
      image_avg_colors: product.imageAvgColors ?? [],
      channels: product.channels,
      sku: product.sku ?? null,
      category: product.category ?? null,
      source_provider: product.sourceProvider ?? null,
      source_product_id: product.sourceProductId ?? null,
      synced_at: product.syncedAt ?? null,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    });
    if (error) throw error;

    if (product.type === "ecommerce") {
      const variantId = createVariantId();
      const { error: variantError } = await this.client
        .from("product_variants")
        .insert({
          id: variantId,
          product_id: product.id,
          title: "Default Title",
          sku: product.sku ?? null,
          price: product.price,
          currency: product.currency,
          option_values: {},
          position: 0,
          created_at: now,
          updated_at: now,
        });
      if (variantError) throw variantError;

      const { error: inventoryError } = await this.client
        .from("inventory_levels")
        .insert({
          variant_id: variantId,
          quantity: 0,
          tracked: false,
          updated_at: now,
        });
      if (inventoryError) throw inventoryError;
    }

    return product;
  }

  async upsertImportedProduct(
    canonical: CanonicalProduct,
    workspaceId: string,
  ): Promise<Product> {
    const now = new Date().toISOString();
    const summary = denormalizeFromCanonical(canonical);

    const { data: existing, error: existingError } = await this.client
      .from("products")
      .select("id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("source_provider", canonical.sourceProvider)
      .eq("source_product_id", canonical.sourceProductId)
      .maybeSingle();
    if (existingError) throw existingError;

    const productId = existing?.id ?? createProductId();
    const createdAt = existing?.created_at ?? now;
    const channels = [canonical.sourceProvider];

    const productRow = {
      id: productId,
      workspace_id: workspaceId,
      title: canonical.title,
      handle: canonical.handle,
      description: canonical.description,
      status: canonical.status,
      type: "ecommerce" as const,
      metadata: { fulfillmentKind: "physical" as const },
      price: summary.price,
      currency: summary.currency,
      images: canonical.images,
      image_avg_colors: canonical.imageAvgColors ?? [],
      channels,
      sku: summary.sku ?? null,
      category: summary.category ?? null,
      source_provider: canonical.sourceProvider,
      source_product_id: canonical.sourceProductId,
      synced_at: now,
      created_at: createdAt,
      updated_at: now,
    };

    const { error: productError } = await this.client
      .from("products")
      .upsert(productRow, { onConflict: "id" });
    if (productError) throw productError;

    const { error: deleteOptionsError } = await this.client
      .from("product_options")
      .delete()
      .eq("product_id", productId);
    if (deleteOptionsError) throw deleteOptionsError;

    if (canonical.options.length > 0) {
      const { error: optionsError } = await this.client
        .from("product_options")
        .insert(
          canonical.options.map((option) => ({
            id: createOptionId(),
            product_id: productId,
            name: option.name,
            position: option.position,
          })),
        );
      if (optionsError) throw optionsError;
    }

    const { data: existingVariants, error: existingVariantsError } =
      await this.client
        .from("product_variants")
        .select("id, source_variant_id")
        .eq("product_id", productId);
    if (existingVariantsError) throw existingVariantsError;

    const variantIdBySource = new Map(
      ((existingVariants ?? []) as { id: string; source_variant_id: string | null }[])
        .filter((row) => row.source_variant_id)
        .map((row) => [row.source_variant_id as string, row.id]),
    );

    const incomingSourceIds = new Set(
      canonical.variants.map((variant) => variant.sourceVariantId),
    );
    const staleVariantIds = ((existingVariants ?? []) as {
      id: string;
      source_variant_id: string | null;
    }[])
      .filter(
        (row) =>
          !row.source_variant_id || !incomingSourceIds.has(row.source_variant_id),
      )
      .map((row) => row.id);

    if (staleVariantIds.length > 0) {
      const { error: deleteVariantsError } = await this.client
        .from("product_variants")
        .delete()
        .in("id", staleVariantIds);
      if (deleteVariantsError) throw deleteVariantsError;
    }

    for (const variant of canonical.variants) {
      const variantId =
        variantIdBySource.get(variant.sourceVariantId) ?? createVariantId();
      const { error: variantError } = await this.client
        .from("product_variants")
        .upsert(
          {
            id: variantId,
            product_id: productId,
            title: variant.title,
            sku: variant.sku ?? null,
            barcode: variant.barcode ?? null,
            price: variant.price,
            compare_at_price: variant.compareAtPrice ?? null,
            currency: variant.currency,
            option_values: variant.optionValues,
            position: variant.position,
            source_variant_id: variant.sourceVariantId,
            image_url: variant.imageUrl ?? null,
            created_at: now,
            updated_at: now,
          },
          { onConflict: "id" },
        );
      if (variantError) throw variantError;

      const { error: inventoryError } = await this.client
        .from("inventory_levels")
        .upsert(
          {
            variant_id: variantId,
            quantity: variant.inventoryQuantity,
            tracked: variant.inventoryTracked,
            updated_at: now,
          },
          { onConflict: "variant_id" },
        );
      if (inventoryError) throw inventoryError;
    }

    const collectionIds: string[] = [];
    for (const collection of canonical.collections) {
      const { data: existingCollection, error: collectionLookupError } =
        await this.client
          .from("collections")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("source_provider", canonical.sourceProvider)
          .eq("source_collection_id", collection.sourceCollectionId)
          .maybeSingle();
      if (collectionLookupError) throw collectionLookupError;

      const collectionId = existingCollection?.id ?? createCollectionId();
      const { error: collectionError } = await this.client
        .from("collections")
        .upsert(
          {
            id: collectionId,
            workspace_id: workspaceId,
            title: collection.title,
            handle: collection.handle,
            source_provider: canonical.sourceProvider,
            source_collection_id: collection.sourceCollectionId,
            created_at: now,
            updated_at: now,
          },
          { onConflict: "id" },
        );
      if (collectionError) throw collectionError;
      collectionIds.push(collectionId);
    }

    const { error: clearLinksError } = await this.client
      .from("product_collections")
      .delete()
      .eq("product_id", productId);
    if (clearLinksError) throw clearLinksError;

    if (collectionIds.length > 0) {
      const { error: linkError } = await this.client
        .from("product_collections")
        .insert(
          collectionIds.map((collectionId) => ({
            product_id: productId,
            collection_id: collectionId,
          })),
        );
      if (linkError) throw linkError;
    }

    const saved = await this.getProduct(productId);
    if (!saved) {
      throw new Error("Failed to load imported product");
    }
    return saved;
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

  async listConnections(workspaceId: string): Promise<CommerceConnection[]> {
    const { data, error } = await this.client
      .from("commerce_connections")
      .select(
        "id, workspace_id, provider, shop_domain, scope, status, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Omit<DbConnection, "access_token">[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      shopDomain: row.shop_domain,
      scope: row.scope,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getConnection(
    workspaceId: string,
    provider: CommerceProvider,
    shopDomain?: string,
  ): Promise<CommerceConnectionRecord | null> {
    let query = this.client
      .from("commerce_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (shopDomain) {
      query = query.eq("shop_domain", shopDomain);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapConnection(data as DbConnection) : null;
  }

  async upsertConnection(
    connection: CommerceConnectionRecord,
  ): Promise<CommerceConnection> {
    const { data: existing, error: lookupError } = await this.client
      .from("commerce_connections")
      .select("id, created_at")
      .eq("workspace_id", connection.workspaceId)
      .eq("provider", connection.provider)
      .eq("shop_domain", connection.shopDomain)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const id = existing?.id ?? connection.id;
    const createdAt = existing?.created_at ?? connection.createdAt;
    const { error } = await this.client.from("commerce_connections").upsert(
      {
        id,
        workspace_id: connection.workspaceId,
        provider: connection.provider,
        shop_domain: connection.shopDomain,
        access_token: connection.accessToken,
        scope: connection.scope,
        status: connection.status,
        created_at: createdAt,
        updated_at: connection.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    return {
      id,
      workspaceId: connection.workspaceId,
      provider: connection.provider,
      shopDomain: connection.shopDomain,
      scope: connection.scope,
      status: connection.status,
      createdAt,
      updatedAt: connection.updatedAt,
    };
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
