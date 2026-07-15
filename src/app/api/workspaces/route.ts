import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = await getWorkspaceRepository();
    const workspaces = await repo.listWorkspacesForUser(user.id);
    return NextResponse.json({ workspaces });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = await getWorkspaceRepository();
    const workspace = await repo.createWorkspace(parsed.data.name, user.id);
    await repo.setActiveWorkspace(user.id, workspace.id);

    const response = NextResponse.json({ workspace }, { status: 201 });
    response.cookies.set(
      WORKSPACE_COOKIE,
      workspace.id,
      workspaceCookieOptions(),
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
