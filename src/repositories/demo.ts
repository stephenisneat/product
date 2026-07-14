import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";
import { getDemoPerformance, getDemoStore } from "@/lib/demo/store";
import type { ArtifactRepository, ProductRepository } from "./types";

export class DemoProductRepository implements ProductRepository {
  async listProducts(ownerId: string): Promise<Product[]> {
    const store = getDemoStore();
    return store.products
      .filter((p) => p.ownerId === ownerId)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async getProduct(id: string): Promise<Product | null> {
    return getDemoStore().products.find((p) => p.id === id) ?? null;
  }

  async getIntelligence(productId: string): Promise<ProductIntelligence | null> {
    return getDemoStore().intelligence.find((i) => i.productId === productId) ?? null;
  }

  async upsertIntelligence(
    intelligence: ProductIntelligence,
  ): Promise<ProductIntelligence> {
    const store = getDemoStore();
    const index = store.intelligence.findIndex(
      (i) => i.productId === intelligence.productId,
    );
    if (index >= 0) {
      store.intelligence[index] = intelligence;
    } else {
      store.intelligence.push(intelligence);
    }
    return intelligence;
  }

  async listCampaigns(productId: string): Promise<Campaign[]> {
    return getDemoStore().campaigns.filter((c) => c.productId === productId);
  }

  async getPerformance(productId: string): Promise<PerformancePoint[]> {
    return getDemoPerformance(productId);
  }
}

export class DemoArtifactRepository implements ArtifactRepository {
  async listByProduct(productId: string): Promise<Artifact[]> {
    return getDemoStore()
      .artifacts.filter((a) => a.productId === productId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getById(id: string): Promise<Artifact | null> {
    return getDemoStore().artifacts.find((a) => a.id === id) ?? null;
  }

  async create(artifact: Artifact): Promise<Artifact> {
    getDemoStore().artifacts.unshift(artifact);
    return artifact;
  }

  async update(artifact: Artifact): Promise<Artifact> {
    const store = getDemoStore();
    const index = store.artifacts.findIndex((a) => a.id === artifact.id);
    if (index < 0) {
      throw new Error(`Artifact ${artifact.id} not found`);
    }
    store.artifacts[index] = artifact;
    return artifact;
  }
}
