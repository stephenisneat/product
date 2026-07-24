import type {
  Campaign,
  Creative,
  Goal,
  Insight,
  PerformancePoint,
  Product,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import {
  ProductChrome,
  ProductPageHeader,
} from "@/features/products/product-chrome";
import { ProductPerformanceOverview } from "@/features/products/product-performance-overview";
import {
  ProductPulse,
  resolveProductMaturity,
} from "@/features/products/product-pulse";
import {
  ProductStreamImprove,
  ProductStreamKnow,
  ProductStreamLibrary,
  ProductStreamRun,
} from "@/features/products/product-streams";

export function ProductContextWorkspace({
  product,
  intelligence,
  creatives = [],
  campaigns,
  performance,
  goals = [],
  insights = [],
  plan = "free",
}: {
  product: Product;
  intelligence: ProductIntelligence | null;
  creatives?: Creative[];
  campaigns: Campaign[];
  performance: PerformancePoint[];
  goals?: Goal[];
  insights?: Insight[];
  plan?: WorkspacePlan;
}) {
  const awaitingInsights = insights.filter(
    (i) =>
      i.status === "awaiting_review" ||
      i.status === "revising" ||
      i.status === "generating",
  );
  const maturity = resolveProductMaturity({
    intelligence,
    campaigns,
    awaitingInsights,
  });

  return (
    <PageCanvas header={<ProductPageHeader product={product} />}>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        <ProductChrome product={product} plan={plan} />

        <ProductPulse
          maturity={maturity}
          awaitingInsights={awaitingInsights}
          campaigns={campaigns}
          creatives={creatives}
          goals={goals}
          performance={performance}
        />

        <ProductPerformanceOverview productId={product.id} />

        <ProductStreamKnow product={product} intelligence={intelligence} />

        <ProductStreamRun
          product={product}
          campaigns={campaigns}
          creatives={creatives}
          insights={insights}
          plan={plan}
        />

        <ProductStreamImprove
          product={product}
          goals={goals}
          insights={insights}
          performance={performance}
          plan={plan}
        />

        <ProductStreamLibrary product={product} />
      </div>
    </PageCanvas>
  );
}
