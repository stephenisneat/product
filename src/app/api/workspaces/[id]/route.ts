import { NextResponse } from "next/server";
import { z } from "zod";
import { workspacePlanSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  canManageWorkspace,
} from "@/lib/auth/workspace";
import { parseWorkEmailDomain } from "@/lib/workspaces/domain";
import { resolveAvatarUrl } from "@/lib/workspaces/favicon";
import { getWorkspaceRepository } from "@/repositories";

function storedWorkJoinDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  try {
    return parseWorkEmailDomain(domain);
  } catch {
    return null;
  }
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    clearAvatar: z.boolean().optional(),
    plan: workspacePlanSchema.optional(),
    joinDomain: z.string().trim().nullable().optional(),
    domainJoinEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.avatarUrl !== undefined ||
      data.clearAvatar !== undefined ||
      data.plan !== undefined ||
      data.joinDomain !== undefined ||
      data.domainJoinEnabled !== undefined,
    { message: "At least one field is required" },
  );

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
    const workspace = await repo.getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace, role: membership.role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
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

    const isOwner = canManageWorkspace(membership.role);
    const body = parsed.data;

    if (
      (body.plan !== undefined ||
        body.joinDomain !== undefined ||
        body.domainJoinEnabled !== undefined) &&
      !isOwner
    ) {
      return NextResponse.json(
        { error: "Only the owner can change plan or domain join settings." },
        { status: 403 },
      );
    }

    const current = await repo.getWorkspace(id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let joinDomain: string | null;
    try {
      if (body.joinDomain === undefined) {
        // Drop any previously stored personal domains.
        joinDomain = storedWorkJoinDomain(current.joinDomain);
      } else if (body.joinDomain === null || body.joinDomain === "") {
        joinDomain = null;
      } else {
        joinDomain = parseWorkEmailDomain(body.joinDomain);
      }
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

    const domainJoinEnabled =
      (body.domainJoinEnabled ?? current.domainJoinEnabled) &&
      Boolean(joinDomain);

    if (
      (body.domainJoinEnabled ?? current.domainJoinEnabled) &&
      !joinDomain
    ) {
      return NextResponse.json(
        {
          error:
            "A company email domain is required when domain join is enabled. Personal providers are not allowed.",
        },
        { status: 400 },
      );
    }

    const avatarUrl = resolveAvatarUrl({
      currentAvatarUrl: current.avatarUrl,
      nextAvatarUrl: body.avatarUrl,
      joinDomain: domainJoinEnabled ? joinDomain : null,
      clearAvatar: body.clearAvatar,
    });

    const workspace = await repo.updateWorkspace(id, {
      name: body.name,
      avatarUrl:
        body.avatarUrl !== undefined ||
        body.clearAvatar ||
        body.joinDomain !== undefined ||
        body.domainJoinEnabled !== undefined
          ? avatarUrl
          : undefined,
      plan: body.plan,
      joinDomain:
        body.joinDomain !== undefined || body.domainJoinEnabled !== undefined
          ? joinDomain
          : undefined,
      domainJoinEnabled:
        body.domainJoinEnabled !== undefined ? domainJoinEnabled : undefined,
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
