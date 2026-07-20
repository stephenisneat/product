import { notFound, redirect } from "next/navigation";
import { CreativeWorkspace } from "@/features/creatives/creative-workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getCreativeRepository, getProductRepository } from "@/repositories";

const CREATIVE_TABS = [
  "screenplay",
  "storyboard",
  "video",
  "performance",
] as const;

export default async function CreativeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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
  const { tab } = await searchParams;
  const initialTab = CREATIVE_TABS.includes(
    tab as (typeof CREATIVE_TABS)[number],
  )
    ? (tab as (typeof CREATIVE_TABS)[number])
    : undefined;

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
    <CreativeWorkspace
      creative={creative}
      product={product}
      performance={performance}
      initialTab={initialTab}
    />
  );
}
