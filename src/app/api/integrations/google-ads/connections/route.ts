import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import { hasGoogleAdsConfig } from "@/lib/channels/providers/google-ads";
import { toPublicAdConnection } from "@/lib/channels/providers/google-ads/session";
import { getAdConnectionRepository } from "@/repositories";

/** List Google Ads connections for the active workspace. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  try {
    const repo = await getAdConnectionRepository();
    const connections = await repo.listConnections(active.workspace.id);
    const google = connections.filter((c) => c.provider === "google");
    return NextResponse.json({
      googleAdsConfigured: hasGoogleAdsConfig(),
      connections: google,
      pending: google.find(
        (c) => c.status === "pending" && !c.externalAccountId,
      ) ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Disconnect a Google Ads connection. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  if (!canManageMembers(active.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can disconnect Google Ads." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }

  try {
    const repo = await getAdConnectionRepository();
    const connection = await repo.getConnection(id);
    if (!connection || connection.workspaceId !== active.workspace.id) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    await repo.deleteConnection(id);
    return NextResponse.json({ ok: true, connection: toPublicAdConnection(connection) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
