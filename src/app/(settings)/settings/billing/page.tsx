import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { BillingPanel } from "@/features/billing/billing-panel";
import { getWorkspaceRepository } from "@/repositories";

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/billing");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const repo = await getWorkspaceRepository();
  const members = await repo.listMembers(active.workspace.id);

  const params = await searchParams;
  const checkoutNote =
    params.checkout === "success"
      ? "Subscription updated. It may take a moment for your plan to refresh."
      : params.checkout === "cancelled"
        ? "Checkout cancelled."
        : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan for {active.workspace.name}. Included AI usage renews
          each month with rollover.
        </p>
        {checkoutNote ? (
          <p className="mt-2 text-sm text-muted-foreground">{checkoutNote}</p>
        ) : null}
      </div>

      <BillingPanel
        workspace={active.workspace}
        role={active.role}
        memberCount={members.length}
      />
    </div>
  );
}
