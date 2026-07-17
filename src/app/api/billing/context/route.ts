import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

export const runtime = "nodejs";

/** Active workspace billing context for the upgrade overlay. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const repo = await getWorkspaceRepository();
  const members = await repo.listMembers(active.workspace.id);

  return NextResponse.json({
    workspace: active.workspace,
    role: active.role,
    memberCount: members.length,
  });
}
