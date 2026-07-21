import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/features/settings/change-password-form";
import { SessionsPanel } from "@/features/settings/sessions-panel";
import { TwoFactorPanel } from "@/features/settings/two-factor-panel";
import { getMfaStatus } from "@/lib/auth/mfa";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/security");
  }

  const [active, supabase] = await Promise.all([
    getActiveWorkspace(),
    createClient(),
  ]);
  const mfaStatus = await getMfaStatus(supabase);
  const workspaceRequiresMfa = Boolean(active?.workspace.requireMfa);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Password</h2>
          <ChangePasswordForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Two-factor authentication</h2>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading 2FA…</p>
            }
          >
            <TwoFactorPanel
              workspaceRequiresMfa={workspaceRequiresMfa}
              initialFactors={mfaStatus.verifiedFactors}
            />
          </Suspense>
        </section>

        <SessionsPanel />
      </div>
    </div>
  );
}
