import type { Insight, Product } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { ProductPageHeader } from "@/features/products/product-chrome";
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
      <div className="w-full flex justify-center py-20">
        <ProductStreamDecide
          awaitingInsights={awaitingInsights}
          productTitle={product.title}
        />
      </div>
    </PageCanvas>
  );
}
