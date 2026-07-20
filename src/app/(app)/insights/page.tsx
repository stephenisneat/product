import { redirect } from "next/navigation";
import { PageCanvas } from "@/components/layout/page-canvas";
import { InsightsPageClient } from "@/features/insights/insights-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getEntitlements } from "@/lib/billing/entitlements";
import {
  getGoalRepository,
  getInsightRepository,
  getProductRepository,
} from "@/repositories";

export default async function InsightsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/insights");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const plan = active.workspace.plan ?? "free";
  const locked = !getEntitlements(plan).hasInsights;

  if (locked) {
    return (
      <PageCanvas>
        <InsightsPageClient
          plan={plan}
          locked
          goals={[]}
          insights={[]}
          products={[]}
        />
      </PageCanvas>
    );
  }

  const [goalsRepo, insightsRepo, productsRepo] = await Promise.all([
    getGoalRepository(),
    getInsightRepository(),
    getProductRepository(),
  ]);

  const [goals, insights, products] = await Promise.all([
    goalsRepo.listByWorkspace(active.workspace.id),
    insightsRepo.listByWorkspace(active.workspace.id),
    productsRepo.listProducts(active.workspace.id),
  ]);

  return (
    <PageCanvas>
      <InsightsPageClient
        plan={plan}
        locked={false}
        goals={goals}
        insights={insights}
        products={products.map((p) => ({ id: p.id, title: p.title }))}
      />
    </PageCanvas>
  );
}
