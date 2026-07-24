import type { Insight, Product } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { ProductPageHeader } from "@/features/products/product-chrome";
import { ProductPerformanceOverview } from "@/features/products/product-performance-overview";
import { ProductStreamDecide } from "@/features/products/product-streams";

export function ProductWorkspace({
  product,
  insights = [],
}: {
  product: Product;
  insights?: Insight[];
}) {
  const awaitingInsights = insights.filter(
    (i) =>
      i.status === "awaiting_review" ||
      i.status === "revising" ||
      i.status === "generating",
  );

  return (
    <PageCanvas header={<ProductPageHeader product={product} />}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
        <ProductStreamDecide
          awaitingInsights={awaitingInsights}
          productTitle={product.title}
        />
      </div>
      <div className="border-b border-border w-full min-h-96 bg-neutral-900">
        <ProductPerformanceOverview productId={product.id} />
      </div>
    </PageCanvas>
  );
}
