import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";
import { ContainerManager } from "@/features/plugin/container-manager";
import { platformLabel } from "@/features/plugin/install-platforms";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ pluginId: string }>;
};

export default async function PluginDetailPage({ params }: PageProps) {
  const { pluginId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/settings/plugin/${pluginId}`);
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const client = hasServiceRole()
    ? createServiceClient()
    : await createClient();

  const { data: container } = await client
    .from("plugin_containers")
    .select("id, name, platform, domain")
    .eq("id", pluginId)
    .eq("workspace_id", active.workspace.id)
    .maybeSingle();

  if (!container) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/settings/plugin"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All plugins
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {container.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {platformLabel(container.platform)}
          {container.domain ? ` · ${container.domain}` : ""}
          {" — "}
          manage tags, triggers, and variables.
        </p>
      </div>

      <div className="h-[70vh] min-h-[560px] overflow-hidden rounded-lg border border-border">
        <ContainerManager
          apiBase={`/api/plugin/containers/${pluginId}`}
          displayName={container.name}
        />
      </div>
    </div>
  );
}
