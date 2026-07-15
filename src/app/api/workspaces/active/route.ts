import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { getWorkspaceRepository } from "@/repositories";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
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
    const membership = await repo.getMembership(
      parsed.data.workspaceId,
      user.id,
    );
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await repo.setActiveWorkspace(user.id, parsed.data.workspaceId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      WORKSPACE_COOKIE,
      parsed.data.workspaceId,
      workspaceCookieOptions(),
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to set active workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
