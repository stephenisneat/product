import { redirect } from "next/navigation";
import {
  DEFAULT_INSIGHT_SETTINGS,
  type InsightSettings,
} from "@/domain";
import { InsightSettingsPanel } from "@/features/settings/insight-settings-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getInsightSettingsForWorkspace } from "@/lib/insights/insight-settings";
import { createClient } from "@/lib/supabase/server";
import { getGoalRepository, getProductRepository } from "@/repositories";

export default async function GoalsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/goals");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const plan = active.workspace.plan ?? "free";
  const hasInsights = getEntitlements(plan).hasInsights;
  const canEdit = active.role === "owner" || active.role === "admin";

  let settings: InsightSettings = DEFAULT_INSIGHT_SETTINGS;
  let goals: Awaited<
    ReturnType<Awaited<ReturnType<typeof getGoalRepository>>["listByWorkspace"]>
  > = [];
  let products: { id: string; title: string }[] = [];

  if (hasInsights) {
    const supabase = await createClient();
    const [goalsRepo, productsRepo, loaded] = await Promise.all([
      getGoalRepository(),
      getProductRepository(),
      getInsightSettingsForWorkspace(supabase, active.workspace.id).catch(
        () => DEFAULT_INSIGHT_SETTINGS,
      ),
    ]);
    settings = loaded;
    const [goalRows, productRows] = await Promise.all([
      goalsRepo.listByWorkspace(active.workspace.id),
      productsRepo.listProducts(active.workspace.id),
    ]);
    goals = goalRows;
    products = productRows.map((p) => ({ id: p.id, title: p.title }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goals and triggers for {active.workspace.name}.
        </p>
      </div>

      {hasInsights ? (
        <InsightSettingsPanel
          initialSettings={settings}
          goals={goals}
          products={products}
          canEdit={canEdit}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Insights settings are available on the Pro plan.
          </p>
        </div>
      )}
    </div>
  );
}
