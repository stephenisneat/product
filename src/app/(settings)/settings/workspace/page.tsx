import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { WorkspaceProfilePanel } from "@/features/workspaces/workspace-profile-panel";

export default async function WorkspaceProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/workspace");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Workspace profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage {active.workspace.name} avatar, name, domain, and join
          settings.
        </p>
      </div>

      <WorkspaceProfilePanel
        workspace={active.workspace}
        role={active.role}
        currentUserEmail={user.email}
      />
    </div>
  );
}
