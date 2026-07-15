import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers } from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, userId } = await params;

  try {
    const repo = await getWorkspaceRepository();
    const actor = await repo.getMembership(id, user.id);
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSelf = userId === user.id;
    if (!isSelf && !canManageMembers(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await repo.getMembership(id, userId);
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the workspace owner" },
        { status: 400 },
      );
    }
    if (!isSelf && actor.role === "admin" && target.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot remove other admins" },
        { status: 403 },
      );
    }

    await repo.removeMember(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
