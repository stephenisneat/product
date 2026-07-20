import { notFound, redirect } from "next/navigation";
import { AgentProductSync } from "@/features/agent/agent-context";
import { ProductWorkspace } from "@/features/products/product-workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getArtifactRepository, getCreativeRepository, getProductRepository } from "@/repositories";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const { id } = await params;
  const products = await getProductRepository();
  const product = await products.getProduct(id);
  if (!product) {
    notFound();
  }

  const [intelligence, campaigns, performance, artifacts, creatives] =
    await Promise.all([
      products.getIntelligence(id),
      products.listCampaigns(id),
      products.getPerformance(id),
      (await getArtifactRepository()).listByProduct(id),
      (await getCreativeRepository()).listByProduct(id),
    ]);

  return (
    <>
      <AgentProductSync productId={product.id} productTitle={product.title} />
      <ProductWorkspace
        product={product}
        intelligence={intelligence}
        artifacts={artifacts}
        creatives={creatives}
        campaigns={campaigns}
        performance={performance}
        plan={active.workspace.plan ?? "free"}
      />
    </>
  );
}
