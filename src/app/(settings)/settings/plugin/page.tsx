import { redirect } from "next/navigation";
import { ContainerManager } from "@/features/plugin/container-manager";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";

export default async function PluginSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/plugin");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Plugin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage tags, triggers, and variables for {active.workspace.name}.
        </p>
      </div>

      <div className="h-[70vh] min-h-[560px] overflow-hidden rounded-lg border border-border">
        <ContainerManager displayName={active.workspace.name} />
      </div>
    </div>
  );
}
