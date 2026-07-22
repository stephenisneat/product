import { PageCanvas } from "@/components/layout/page-canvas";
import { MarketingHome } from "@/features/marketing/marketing-home";
import { resolveCatalogStatus } from "@/features/products/catalog-status";
import { ProductCatalog } from "@/features/products/product-catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  getArtifactRepository,
  getInsightRepository,
  getProductRepository,
} from "@/repositories";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <MarketingHome />;
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return (
      <PageCanvas>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            No workspace yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have a workspace. Try signing out and back in,
            or contact support.
          </p>
        </div>
      </PageCanvas>
    );
  }

  const [products, artifactsRepo, insightsRepo] = await Promise.all([
    getProductRepository(),
    getArtifactRepository(),
    getInsightRepository(),
  ]);
  const catalog = await products.listProducts(active.workspace.id);
  const productIds = catalog.map((product) => product.id);

  const [campaigns, artifacts, pendingInsights] = await Promise.all([
    products.listCampaignsForProducts(productIds),
    artifactsRepo.listByProductIds(productIds),
    insightsRepo.listByWorkspace(active.workspace.id, {
      status: ["awaiting_review", "revising", "generating"],
      limit: 1000,
    }),
  ]);

  const campaignsByProduct = new Map<string, typeof campaigns>();
  for (const campaign of campaigns) {
    const list = campaignsByProduct.get(campaign.productId) ?? [];
    list.push(campaign);
    campaignsByProduct.set(campaign.productId, list);
  }

  const needsAttentionIds = new Set<string>();
  for (const artifact of artifacts) {
    if (artifact.status === "proposed") {
      needsAttentionIds.add(artifact.productId);
    }
  }
  for (const insight of pendingInsights) {
    if (insight.productId) {
      needsAttentionIds.add(insight.productId);
    }
  }

  const catalogStatusByProductId = Object.fromEntries(
    catalog.map((product) => [
      product.id,
      resolveCatalogStatus(
        campaignsByProduct.get(product.id) ?? [],
        needsAttentionIds.has(product.id),
      ),
    ]),
  );

  return (
    <ProductCatalog
      products={catalog}
      catalogStatusByProductId={catalogStatusByProductId}
    />
  );
}
