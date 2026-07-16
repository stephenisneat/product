import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspaceRepository } from "@/repositories";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = await getWorkspaceRepository();
    const workspaces = await repo.listDiscoverableWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list discoverable workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
