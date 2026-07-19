import Link from "next/link";
import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { Badge } from "@/components/ui/badge";
import { CreativeCard } from "@/features/creatives/creative-card";
import { CatalogNav } from "@/features/products/catalog-toolbar";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getCreativeRepository, getProductRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export default async function CreativesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/creatives");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const plan = active.workspace.plan ?? "free";
  const ents = getEntitlements(plan);
  const creativeLimit =
    ents.maxCreativesPerCampaign == null
      ? "Unlimited creatives per campaign"
      : ents.maxCreativesPerCampaign === 0
        ? "Creatives are locked on Free — upgrade to Hobby or Pro"
        : `Up to ${ents.maxCreativesPerCampaign} creatives per campaign on ${ents.name}`;

  const [creatives, products] = await Promise.all([
    getCreativeRepository().then((repo) =>
      repo.listByWorkspace(active.workspace.id),
    ),
    getProductRepository().then((repo) =>
      repo.listProducts(active.workspace.id),
    ),
  ]);

  const productTitleById = new Map(products.map((p) => [p.id, p.title]));

  return (
    <PageCanvas header={<CatalogNav workspaceId={active.workspace.id} />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Video creatives for {active.workspace.name}. {creativeLimit}. Ask the
          agent to create a video ad from an idea.
        </p>

        {creatives.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No video creatives yet. Describe an ad idea in chat to start
            screenplay → storyboard → video.
          </div>
        ) : (
          <ul className="space-y-3">
            {creatives.map((creative) => (
              <li key={creative.id}>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <Link
                    href={`/creatives/${creative.id}`}
                    className="text-xs font-medium hover:underline"
                  >
                    Open detail
                  </Link>
                  <Badge variant="outline" className="text-[10px]">
                    {productTitleById.get(creative.productId) ?? "Product"}
                  </Badge>
                </div>
                <CreativeCard creative={creative} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageCanvas>
  );
}
