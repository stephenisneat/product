import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CatalogNav } from "@/features/products/catalog-toolbar";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function VisualizerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/visualizer");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return (
    <PageCanvas header={<CatalogNav />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Performance and funnel visualization for {active.workspace.name}.
        </p>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Visualizer will appear here.
        </div>
      </div>
    </PageCanvas>
  );
}
