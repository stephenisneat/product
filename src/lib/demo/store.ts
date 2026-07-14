import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";
import {
  buildPerformanceSeries,
  seedArtifacts,
  seedCampaigns,
  seedIntelligence,
  seedProducts,
} from "./seed";

type DemoStore = {
  products: Product[];
  intelligence: ProductIntelligence[];
  artifacts: Artifact[];
  campaigns: Campaign[];
};

const globalForDemo = globalThis as unknown as {
  __productAgentDemoStore?: DemoStore;
};

function createStore(): DemoStore {
  return {
    products: structuredClone(seedProducts),
    intelligence: structuredClone(seedIntelligence),
    artifacts: structuredClone(seedArtifacts),
    campaigns: structuredClone(seedCampaigns),
  };
}

export function getDemoStore(): DemoStore {
  if (!globalForDemo.__productAgentDemoStore) {
    globalForDemo.__productAgentDemoStore = createStore();
  }
  return globalForDemo.__productAgentDemoStore;
}

export function resetDemoStore(): void {
  globalForDemo.__productAgentDemoStore = createStore();
}

export function getDemoPerformance(productId: string): PerformancePoint[] {
  return buildPerformanceSeries(productId);
}
