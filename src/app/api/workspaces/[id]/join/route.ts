import { NextResponse } from "next/server";
import { getMfaStatus } from "@/lib/auth/mfa";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  emailDomainFromAddress,
  isConsumerEmailDomain,
  parseWorkEmailDomain,
} from "@/lib/workspaces/domain";
import { getWorkspaceRepository } from "@/repositories";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const userDomain = emailDomainFromAddress(user.email);
    if (!userDomain || isConsumerEmailDomain(userDomain)) {
      return NextResponse.json(
        {
          error:
            "Domain join is only available for company email addresses, not personal providers.",
        },
        { status: 403 },
      );
    }

    const repo = await getWorkspaceRepository();
    const target = await repo.getWorkspace(id);
    if (!target?.domainJoinEnabled || !target.joinDomain) {
      return NextResponse.json(
        { error: "Domain join not allowed" },
        { status: 403 },
      );
    }
    try {
      parseWorkEmailDomain(target.joinDomain);
    } catch {
      return NextResponse.json(
        { error: "Domain join not allowed" },
        { status: 403 },
      );
    }

    if (target.requireMfa) {
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

    await repo.joinWorkspaceByDomain(id);

    const membership = await repo.getMembership(id, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: "Unable to join workspace" },
        { status: 403 },
      );
    }

    const workspace = await repo.getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await repo.setActiveWorkspace(user.id, id);

    const response = NextResponse.json({ workspace, role: membership.role });
    response.cookies.set(WORKSPACE_COOKIE, id, workspaceCookieOptions());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join workspace";
    const status =
      message.includes("not allowed") || message.includes("not found")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
