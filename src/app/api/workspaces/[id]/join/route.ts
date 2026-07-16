import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const repo = await getWorkspaceRepository();
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
