import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import type { ActiveWorkspace } from "@/lib/auth/workspace";
import type { AppUser } from "@/domain";

export async function requireAdChannelAdmin(
  channelLabel: string,
): Promise<
  | { user: AppUser; active: ActiveWorkspace }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const active = await getActiveWorkspace();
  if (!active) {
    return {
      error: NextResponse.json({ error: "No workspace available" }, { status: 400 }),
    };
  }
  if (!canManageMembers(active.role)) {
    return {
      error: NextResponse.json(
        {
          error: `Only workspace owners and admins can manage ${channelLabel}.`,
        },
        { status: 403 },
      ),
    };
  }
  return { user, active };
}

export async function requireAdChannelUser(): Promise<
  | { user: AppUser; active: ActiveWorkspace }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const active = await getActiveWorkspace();
  if (!active) {
    return {
      error: NextResponse.json({ error: "No workspace available" }, { status: 400 }),
    };
  }
  return { user, active };
}
