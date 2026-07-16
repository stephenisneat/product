import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { WorkspaceSettingsPanel } from "@/features/workspaces/workspace-settings-panel";
import { getWorkspaceRepository } from "@/repositories";

export default async function WorkspaceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/workspace");
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
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-card/80">
        <Button
          render={<Link href="/" />}
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Workspace settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage {active.workspace.name} avatar, plan, domain join, members,
            and invites.
          </p>
        </div>

        <WorkspaceSettingsPanel
          workspace={active.workspace}
          role={active.role}
          members={members}
          invites={invites}
          currentUserId={user.id}
          currentUserEmail={user.email}
        />
      </div>
    </div>
  );
}
