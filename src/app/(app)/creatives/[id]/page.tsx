import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { Badge } from "@/components/ui/badge";
import { CreativeCard } from "@/features/creatives/creative-card";
import { CatalogNav } from "@/features/products/catalog-toolbar";
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

  const product = await products.getProduct(creative.productId);

  return (
    <PageCanvas header={<CatalogNav workspaceId={active.workspace.id} />}>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/creatives" className="hover:underline">
            Creatives
          </Link>
          <span>/</span>
          <span className="text-foreground">{creative.title}</span>
          {product ? (
            <Badge variant="outline" className="text-[10px]">
              <Link
                href={`/products/${product.id}`}
                className="hover:underline"
              >
                {product.title}
              </Link>
            </Badge>
          ) : null}
        </div>

        <CreativeCard creative={creative} />

        {creative.status === "ready" ? (
          <p className="text-sm text-muted-foreground">
            This video creative is ready for campaigns.
          </p>
        ) : null}
      </div>
    </PageCanvas>
  );
}
