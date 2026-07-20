import { redirect } from "next/navigation";
import { LockIcon } from "lucide-react";
import { PageCanvas } from "@/components/layout/page-canvas";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { InsightsToolbar } from "@/features/insights/insights-toolbar";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getEntitlements } from "@/lib/billing/entitlements";

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

  return (
    <PageCanvas>
      <InsightsToolbar plan={plan} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Product and marketing insights for {active.workspace.name}.
        </p>
        {locked ? (
          <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--color-foreground) 8%, transparent) 0, transparent 42%), radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--color-foreground) 6%, transparent) 0, transparent 45%)",
              }}
            />
            <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                <LockIcon className="size-5 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Insights are locked
              </h2>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro to unlock product and marketing insights for this
                workspace.
              </p>
              <UpgradeButton size="sm" className="mt-1">
                Upgrade to Pro
              </UpgradeButton>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Insights will appear here.
          </div>
        )}
      </div>
    </PageCanvas>
  );
}
