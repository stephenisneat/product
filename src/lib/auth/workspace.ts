import { cache } from "react";
import { cookies } from "next/headers";
import type { Workspace, WorkspaceRole } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getWorkspaceRepository,
  type WorkspaceWithRole,
} from "@/repositories";

export const WORKSPACE_COOKIE = "pa_workspace_id";

export type ActiveWorkspace = {
  workspace: Workspace;
  role: WorkspaceRole;
  workspaces: WorkspaceWithRole[];
};

function cookieSecure() {
  return (
    process.env.COOKIE_SECURE === "true" || Boolean(process.env.VERCEL)
  );
}

export function workspaceCookieOptions(maxAge = 60 * 60 * 24 * 365) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieSecure(),
    maxAge,
  };
}

export const getActiveWorkspace = cache(
  async (): Promise<ActiveWorkspace | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const workspacesRepo = await getWorkspaceRepository();
    const [workspaces, cookieStore, profileId] = await Promise.all([
      workspacesRepo.listWorkspacesForUser(user.id),
      cookies(),
      workspacesRepo.getActiveWorkspaceId(user.id),
    ]);

    if (workspaces.length === 0) {
      return null;
    }

    const cookieId = cookieStore.get(WORKSPACE_COOKIE)?.value;
    const preferredId = cookieId || profileId || null;
    const selected =
      (preferredId
        ? workspaces.find((ws) => ws.id === preferredId)
        : undefined) ??
      workspaces.find((ws) => ws.role === "owner") ??
      workspaces[0];

    if (!selected) return null;

    const { role, ...workspace } = selected;
    return {
      workspace,
      role,
      workspaces,
    };
  },
);

export async function requireActiveWorkspace(): Promise<ActiveWorkspace> {
  const active = await getActiveWorkspace();
  if (!active) {
    throw new Error("No workspace available");
  }
  return active;
}

export function canManageMembers(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner";
}
