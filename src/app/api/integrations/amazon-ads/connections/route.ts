import { NextResponse } from "next/server";
import { canManageMembers } from "@/lib/auth/workspace";
import { toPublicAdConnection } from "@/lib/channels/ad-connection";
import { requireAdChannelUser } from "@/lib/channels/ad-channel-auth";
import { hasAmazonAdsConfig } from "@/lib/channels/providers/amazon-ads";
import { getAdConnectionRepository } from "@/repositories";

/** List Amazon Ads connections for the active workspace. */
export async function GET() {
  const auth = await requireAdChannelUser();
  if ("error" in auth) return auth.error;

  try {
    const repo = await getAdConnectionRepository();
    const connections = await repo.listConnections(auth.active.workspace.id);
    const amazon = connections.filter((c) => c.provider === "amazon");
    return NextResponse.json({
      amazonAdsConfigured: hasAmazonAdsConfig(),
      connections: amazon,
      pending:
        amazon.find((c) => c.status === "pending" && !c.externalAccountId) ??
        null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Disconnect an Amazon Ads connection. */
export async function DELETE(request: Request) {
  const auth = await requireAdChannelUser();
  if ("error" in auth) return auth.error;

  if (!canManageMembers(auth.active.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can disconnect Amazon Ads." },
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
    if (
      !connection ||
      connection.workspaceId !== auth.active.workspace.id ||
      connection.provider !== "amazon"
    ) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    await repo.deleteConnection(id);
    return NextResponse.json({
      ok: true,
      connection: toPublicAdConnection(connection),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
