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
      <div className="w-full min-h-full flex items-center justify-center">
        <ProductStreamDecide
          awaitingInsights={awaitingInsights}
          productTitle={product.title}
        />
      </div>
      <div className="border-t border-border w-full min-h-96 bg-neutral-900">
        <ProductPerformanceOverview productId={product.id} />
      </div>
    </PageCanvas>
  );
}
