import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceInviteRoleSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers } from "@/lib/auth/workspace";
import { sendWorkspaceInviteEmail } from "@/lib/email/resend";
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
    const invites = await repo.listInvites(id);
    return NextResponse.json({ invites });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list invites";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const createSchema = z.object({
  email: z.string().email(),
  role: workspaceInviteRoleSchema.default("member"),
});

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = await getWorkspaceRepository();
    const membership = await repo.getMembership(id, user.id);
    if (!membership || !canManageMembers(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspace = await repo.getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const email = parsed.data.email.toLowerCase();
    const existingMembers = await repo.listMembers(id);
    if (
      existingMembers.some((m) => m.email?.toLowerCase() === email)
    ) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 },
      );
    }

    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const invite = await repo.createInvite({
      workspaceId: id,
      email,
      role: parsed.data.role,
      invitedBy: user.id,
      token,
      expiresAt,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;
    const inviteUrl = `${appUrl}/invite/${token}`;

    try {
      await sendWorkspaceInviteEmail({
        to: email,
        workspaceName: workspace.name,
        inviterName: user.name,
        role: parsed.data.role,
        inviteUrl,
      });
    } catch (emailError) {
      // Roll back invite if email fails so the UI stays consistent
      await repo.revokeInvite(invite.id);
      throw emailError;
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
