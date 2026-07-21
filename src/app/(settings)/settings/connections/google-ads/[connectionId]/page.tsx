import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { GoogleAdsCampaignManager } from "@/features/channels/google-ads-campaign-manager";
import { getAdConnectionRepository } from "@/repositories";

type PageProps = {
  params: Promise<{ connectionId: string }>;
};

export default async function GoogleAdsManagePage({ params }: PageProps) {
  const { connectionId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/login?next=/settings/connections/google-ads/${connectionId}`,
    );
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const repo = await getAdConnectionRepository();
  const connection = await repo.getConnection(connectionId);
  if (
    !connection ||
    connection.workspaceId !== active.workspace.id ||
    connection.provider !== "google" ||
    connection.status !== "active"
  ) {
    redirect("/settings/connections");
  }

  return (
    <GoogleAdsCampaignManager
      connectionId={connectionId}
      canManage={canManageMembers(active.role)}
    />
  );
}
