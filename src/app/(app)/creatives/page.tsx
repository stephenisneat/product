import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CreativesList } from "@/features/creatives/creatives-list";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getCreativeRepository, getProductRepository } from "@/repositories";

export default async function CreativesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/creatives");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const [creatives, products] = await Promise.all([
    getCreativeRepository().then((repo) =>
      repo.listByWorkspace(active.workspace.id),
    ),
    getProductRepository().then((repo) =>
      repo.listProducts(active.workspace.id),
    ),
  ]);

  return (
    <PageCanvas>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
        <CreativesList
          key={creatives.map((c) => `${c.id}:${c.status}`).join("|")}
          initialCreatives={creatives}
          products={products.map((p) => ({ id: p.id, title: p.title }))}
        />
      </div>
    </PageCanvas>
  );
}
