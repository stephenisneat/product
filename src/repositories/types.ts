import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";

export interface ProductRepository {
  listProducts(ownerId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(product: Product): Promise<Product>;
  getIntelligence(productId: string): Promise<ProductIntelligence | null>;
  upsertIntelligence(intelligence: ProductIntelligence): Promise<ProductIntelligence>;
  listCampaigns(productId: string): Promise<Campaign[]>;
  getPerformance(productId: string): Promise<PerformancePoint[]>;
}

export interface ArtifactRepository {
  listByProduct(productId: string): Promise<Artifact[]>;
  getById(id: string): Promise<Artifact | null>;
  create(artifact: Artifact): Promise<Artifact>;
  update(artifact: Artifact): Promise<Artifact>;
}
