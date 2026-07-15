import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers } from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const repo = await getWorkspaceRepository();
    const membership = await repo.getMembership(id, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const members = await repo.listMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const patchBodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = patchBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = await getWorkspaceRepository();
    const actor = await repo.getMembership(id, user.id);
    if (!actor || !canManageMembers(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await repo.getMembership(id, parsed.data.userId);
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change the owner role" },
        { status: 400 },
      );
    }
    if (actor.role === "admin" && target.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot change other admins" },
        { status: 403 },
      );
    }

    const member = await repo.updateMemberRole(
      id,
      parsed.data.userId,
      parsed.data.role,
    );
    return NextResponse.json({ member });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
