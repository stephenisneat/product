import { notFound, redirect } from "next/navigation";
import { AgentProductSync } from "@/features/agent/agent-context";
import { ProductWorkspace } from "@/features/products/product-workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  getCreativeRepository,
  getGoalRepository,
  getInsightRepository,
  getProductRepository,
} from "@/repositories";

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

  if (product.workspaceId !== active.workspace.id) {
    notFound();
  }

  const [intelligence, campaigns, performance, creatives, goals, insights] =
    await Promise.all([
      products.getIntelligence(id),
      products.listCampaigns(id),
      products.getPerformance(id),
      (await getCreativeRepository()).listByProduct(id),
      (await getGoalRepository()).listByProduct(active.workspace.id, id),
      (await getInsightRepository()).listByProduct(active.workspace.id, id, {
        limit: 40,
      }),
    ]);

  return (
    <>
      <AgentProductSync productId={product.id} productTitle={product.title} />
      <ProductWorkspace
        product={product}
        intelligence={intelligence}
        creatives={creatives}
        campaigns={campaigns}
        performance={performance}
        goals={goals}
        insights={insights}
        plan={active.workspace.plan ?? "free"}
      />
    </>
  );
}
