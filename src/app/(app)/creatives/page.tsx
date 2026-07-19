import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CatalogNav } from "@/features/products/catalog-toolbar";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getEntitlements } from "@/lib/billing/entitlements";

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

  return (
    <PageCanvas header={<CatalogNav workspaceId={active.workspace.id} />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Creative assets and variants for {active.workspace.name}.{" "}
          {creativeLimit}.
        </p>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Creatives will appear here.
        </div>
      </div>
    </PageCanvas>
  );
}
