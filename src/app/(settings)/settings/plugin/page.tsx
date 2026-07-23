import { redirect } from "next/navigation";
import { PluginList } from "@/features/plugin/plugin-list";
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
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <PluginList workspaceName={active.workspace.name} />
    </div>
  );
}
