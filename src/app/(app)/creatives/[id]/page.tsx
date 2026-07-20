import { notFound, redirect } from "next/navigation";
import { AgentProductSync } from "@/features/agent/agent-context";
import { CreativeWorkspace } from "@/features/creatives/creative-workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getCreativeRepository, getProductRepository } from "@/repositories";

export default async function CreativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/creatives");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const { id } = await params;
  const [creatives, products] = await Promise.all([
    getCreativeRepository(),
    getProductRepository(),
  ]);
  const creative = await creatives.getById(id);
  if (!creative || creative.workspaceId !== active.workspace.id) {
    notFound();
  }

  const [product, performance] = await Promise.all([
    products.getProduct(creative.productId),
    products.getPerformance(creative.productId),
  ]);

  return (
    <>
      {product ? (
        <AgentProductSync
          productId={product.id}
          productTitle={product.title}
        />
      ) : null}
      <CreativeWorkspace
        creative={creative}
        product={product}
        performance={performance}
      />
    </>
  );
}
