import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/features/settings/change-password-form";
import { SessionsPanel } from "@/features/settings/sessions-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/security");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password and active sessions.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Password</h2>
          <ChangePasswordForm />
        </section>

        <SessionsPanel />
      </div>
    </div>
  );
}
