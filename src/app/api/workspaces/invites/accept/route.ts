import { NextResponse } from "next/server";
import { z } from "zod";
import { getMfaStatus } from "@/lib/auth/mfa";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceRepository } from "@/repositories";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = await getWorkspaceRepository();
    const invite = await repo.getInviteByToken(parsed.data.token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `This invite was sent to ${invite.email}. Sign in with that email to accept.`,
        },
        { status: 403 },
      );
    }

    const workspace = await repo.getWorkspace(invite.workspaceId);
    if (workspace?.requireMfa) {
      const supabase = await createClient();
      const status = await getMfaStatus(supabase);
      if (!status.hasVerifiedFactor) {
        return NextResponse.json(
          {
            error:
              "This workspace requires two-factor authentication. Enable 2FA in Security settings first.",
            code: "MFA_ENROLL",
            redirectTo: "/settings/security?required=1",
          },
          { status: 403 },
        );
      }
      if (status.needsChallenge) {
        return NextResponse.json(
          {
            error: "Confirm your two-factor code to continue.",
            code: "MFA_CHALLENGE",
            redirectTo: "/auth/mfa",
          },
          { status: 403 },
        );
      }
    }

    const membership = await repo.acceptInvite(parsed.data.token, user.id);
    await repo.setActiveWorkspace(user.id, membership.workspaceId);

    const response = NextResponse.json({
      workspaceId: membership.workspaceId,
      role: membership.role,
    });
    response.cookies.set(
      WORKSPACE_COOKIE,
      membership.workspaceId,
      workspaceCookieOptions(),
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
