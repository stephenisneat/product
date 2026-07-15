import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers } from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

type Params = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, inviteId } = await params;

  try {
    const repo = await getWorkspaceRepository();
    const membership = await repo.getMembership(id, user.id);
    if (!membership || !canManageMembers(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await repo.revokeInvite(inviteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
