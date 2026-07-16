import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CatalogToolbar } from "@/features/products/catalog-toolbar";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function CreativesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/creatives");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return (
    <PageCanvas header={<CatalogToolbar />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Creatives
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creative assets and variants for {active.workspace.name}.
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Creatives will appear here.
        </div>
      </div>
    </PageCanvas>
  );
}
