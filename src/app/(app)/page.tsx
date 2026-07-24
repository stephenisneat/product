import { PageCanvas } from "@/components/layout/page-canvas";
import { MarketingHome } from "@/features/marketing/marketing-home";
import { resolveCatalogStatus } from "@/features/products/catalog-status";
import { ProductCatalog } from "@/features/products/product-catalog";
import {
  formatDateInput,
  resolveDateRangeBounds,
} from "@/features/visualizer/explore/date-range";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  getInsightRepository,
  getPerformanceRepository,
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

  const [products, insightsRepo, performanceRepo] = await Promise.all([
    getProductRepository(),
    getInsightRepository(),
    getPerformanceRepository(),
  ]);
  const catalog = await products.listProducts(active.workspace.id);
  const productIds = catalog.map((product) => product.id);

  const rangeBounds = resolveDateRangeBounds({
    field: "date",
    preset: "last_30_days",
    start: null,
    end: null,
  });
  const startDate = rangeBounds
    ? formatDateInput(rangeBounds.start)
    : formatDateInput(new Date());
  const endDate = rangeBounds
    ? formatDateInput(rangeBounds.end)
    : formatDateInput(new Date());

  const [campaigns, recentInsights, performanceByProductId] = await Promise.all(
    [
      products.listCampaignsForProducts(productIds),
      insightsRepo.listByWorkspace(active.workspace.id, { limit: 1000 }),
      performanceRepo.totalsByProduct(active.workspace.id, {
        startDate,
        endDate,
        productIds,
      }),
    ],
  );

  const campaignsByProduct = new Map<string, typeof campaigns>();
  for (const campaign of campaigns) {
    const list = campaignsByProduct.get(campaign.productId) ?? [];
    list.push(campaign);
    campaignsByProduct.set(campaign.productId, list);
  }

  const needsAttentionIds = new Set<string>();
  const latestInsightByProductId: Record<
    string,
    { title: string; summary: string; status: string }
  > = {};
  for (const insight of recentInsights) {
    if (!insight.productId) continue;
    if (
      insight.status === "awaiting_review" ||
      insight.status === "revising" ||
      insight.status === "generating"
    ) {
      needsAttentionIds.add(insight.productId);
    }
    if (!(insight.productId in latestInsightByProductId)) {
      latestInsightByProductId[insight.productId] = {
        title: insight.title,
        summary: insight.summary,
        status: insight.status,
      };
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
      latestInsightByProductId={latestInsightByProductId}
      performanceByProductId={performanceByProductId}
    />
  );
}
