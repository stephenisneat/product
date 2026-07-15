import type {
  Artifact,
  Campaign,
  CanonicalProduct,
  CommerceConnection,
  CommerceProvider,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";

export type CommerceConnectionRecord = CommerceConnection & {
  accessToken: string;
};

export interface ProductRepository {
  listProducts(ownerId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(product: Product): Promise<Product>;
  upsertImportedProduct(
    canonical: CanonicalProduct,
    ownerId: string,
  ): Promise<Product>;
  getIntelligence(productId: string): Promise<ProductIntelligence | null>;
  upsertIntelligence(intelligence: ProductIntelligence): Promise<ProductIntelligence>;
  listCampaigns(productId: string): Promise<Campaign[]>;
  getPerformance(productId: string): Promise<PerformancePoint[]>;
  listConnections(ownerId: string): Promise<CommerceConnection[]>;
  getConnection(
    ownerId: string,
    provider: CommerceProvider,
    shopDomain?: string,
  ): Promise<CommerceConnectionRecord | null>;
  upsertConnection(
    connection: CommerceConnectionRecord,
  ): Promise<CommerceConnection>;
}

export interface ArtifactRepository {
  listByProduct(productId: string): Promise<Artifact[]>;
  getById(id: string): Promise<Artifact | null>;
  create(artifact: Artifact): Promise<Artifact>;
  update(artifact: Artifact): Promise<Artifact>;
}
