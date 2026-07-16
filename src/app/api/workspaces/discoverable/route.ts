import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  emailDomainFromAddress,
  isConsumerEmailDomain,
  parseWorkEmailDomain,
} from "@/lib/workspaces/domain";
import { getWorkspaceRepository } from "@/repositories";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDomain = emailDomainFromAddress(user.email);
  if (!userDomain || isConsumerEmailDomain(userDomain)) {
    return NextResponse.json({ workspaces: [] });
  }

  try {
    const repo = await getWorkspaceRepository();
    const workspaces = (await repo.listDiscoverableWorkspaces()).filter(
      (workspace) => {
        if (!workspace.joinDomain) return false;
        try {
          parseWorkEmailDomain(workspace.joinDomain);
          return true;
        } catch {
          return false;
        }
      },
    );
    return NextResponse.json({ workspaces });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list discoverable workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
