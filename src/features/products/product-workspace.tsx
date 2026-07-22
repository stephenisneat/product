import type {
  Artifact,
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
  ProductBackLink,
  ProductChrome,
} from "@/features/products/product-chrome";
import {
  ProductPulse,
  resolveProductMaturity,
} from "@/features/products/product-pulse";
import {
  ProductStreamDecide,
  ProductStreamImprove,
  ProductStreamKnow,
  ProductStreamLibrary,
  ProductStreamRun,
} from "@/features/products/product-streams";

export function ProductWorkspace({
  product,
  intelligence,
  artifacts,
  creatives = [],
  campaigns,
  performance,
  goals = [],
  insights = [],
  plan = "free",
}: {
  product: Product;
  intelligence: ProductIntelligence | null;
  artifacts: Artifact[];
  creatives?: Creative[];
  campaigns: Campaign[];
  performance: PerformancePoint[];
  goals?: Goal[];
  insights?: Insight[];
  plan?: WorkspacePlan;
}) {
  const pendingArtifacts = artifacts.filter((a) => a.status === "proposed");
  const awaitingInsights = insights.filter(
    (i) =>
      i.status === "awaiting_review" ||
      i.status === "revising" ||
      i.status === "generating",
  );
  const maturity = resolveProductMaturity({
    intelligence,
    campaigns,
    pendingArtifacts,
    awaitingInsights,
  });

  return (
    <PageCanvas header={<ProductBackLink />}>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        <ProductChrome product={product} plan={plan} />

        <ProductPulse
          maturity={maturity}
          pendingArtifacts={pendingArtifacts}
          awaitingInsights={awaitingInsights}
          campaigns={campaigns}
          creatives={creatives}
          goals={goals}
          performance={performance}
        />

        <ProductStreamKnow product={product} intelligence={intelligence} />

        <ProductStreamDecide
          pendingArtifacts={pendingArtifacts}
          awaitingInsights={awaitingInsights}
          productTitle={product.title}
        />

        <ProductStreamRun
          product={product}
          campaigns={campaigns}
          creatives={creatives}
          artifacts={artifacts}
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
