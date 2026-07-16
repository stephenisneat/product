import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace";
import { parseWorkEmailDomain } from "@/lib/workspaces/domain";
import { resolveAvatarUrl } from "@/lib/workspaces/favicon";
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
  avatarUrl: z.string().url().nullable().optional(),
  joinDomain: z.string().trim().nullable().optional(),
  domainJoinEnabled: z.boolean().optional(),
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
    const wantsDomainJoin = parsed.data.domainJoinEnabled ?? false;
    let joinDomain: string | null = null;

    if (wantsDomainJoin || parsed.data.joinDomain) {
      if (!parsed.data.joinDomain) {
        return NextResponse.json(
          {
            error:
              "A company email domain is required when domain join is enabled.",
          },
          { status: 400 },
        );
      }
      try {
        joinDomain = parseWorkEmailDomain(parsed.data.joinDomain);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Invalid work email domain",
          },
          { status: 400 },
        );
      }
    }

    const domainJoinEnabled = wantsDomainJoin && Boolean(joinDomain);

    const avatarUrl = resolveAvatarUrl({
      nextAvatarUrl: parsed.data.avatarUrl,
      joinDomain,
    });

    const repo = await getWorkspaceRepository();
    const workspace = await repo.createWorkspace({
      name: parsed.data.name,
      createdBy: user.id,
      avatarUrl,
      joinDomain,
      domainJoinEnabled,
    });
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
