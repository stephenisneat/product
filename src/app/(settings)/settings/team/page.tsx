import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { WorkspaceTeamPanel } from "@/features/workspaces/workspace-team-panel";
import { getWorkspaceRepository } from "@/repositories";

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/team");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const repo = await getWorkspaceRepository();
  const [members, invites] = await Promise.all([
    repo.listMembers(active.workspace.id),
    repo.listInvites(active.workspace.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage members and invites for {active.workspace.name}.
        </p>
      </div>

      <WorkspaceTeamPanel
        workspaceId={active.workspace.id}
        role={active.role}
        members={members}
        invites={invites}
        currentUserId={user.id}
      />
    </div>
  );
}
