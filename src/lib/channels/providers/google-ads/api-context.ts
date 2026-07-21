import { NextResponse } from "next/server";
import type { AdConnectionRecord } from "@/repositories/ad-connections";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import type { ActiveWorkspace } from "@/lib/auth/workspace";
import { createGoogleAdsClientFromConnection } from "@/lib/channels/providers/google-ads/session";
import type { GoogleAdsClient } from "@/lib/channels/providers/google-ads";
import { getAdConnectionRepository } from "@/repositories";
import type { AppUser } from "@/domain";

export type GoogleAdsContext = {
  user: AppUser;
  active: ActiveWorkspace;
  connection: AdConnectionRecord;
  client: GoogleAdsClient;
};

export async function requireGoogleAdsConnection(
  connectionId: string,
  opts?: { requireAdmin?: boolean },
): Promise<{ ctx: GoogleAdsContext } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return {
      error: NextResponse.json({ error: "No workspace available" }, { status: 400 }),
    };
  }

  if (opts?.requireAdmin && !canManageMembers(active.role)) {
    return {
      error: NextResponse.json(
        { error: "Only workspace owners and admins can modify Google Ads." },
        { status: 403 },
      ),
    };
  }

  const repo = await getAdConnectionRepository();
  const connection = await repo.getConnection(connectionId);
  if (
    !connection ||
    connection.workspaceId !== active.workspace.id ||
    connection.provider !== "google"
  ) {
    return {
      error: NextResponse.json({ error: "Connection not found" }, { status: 404 }),
    };
  }

  if (connection.status !== "active" || !connection.externalAccountId) {
    return {
      error: NextResponse.json(
        { error: "Google Ads connection is not ready. Select an account first." },
        { status: 400 },
      ),
    };
  }

  try {
    const client = await createGoogleAdsClientFromConnection(connection);
    return { ctx: { user, active, connection, client } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authenticate with Google Ads";
    return { error: NextResponse.json({ error: message }, { status: 502 }) };
  }
}

export function jsonError(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
