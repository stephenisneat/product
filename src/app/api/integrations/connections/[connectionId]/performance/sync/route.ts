import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { enqueueSyncAdPerformanceJob } from "@/lib/jobs/enqueue-ad-performance";
import { getAdConnectionRepository } from "@/repositories";

export const runtime = "nodejs";

type Params = { params: Promise<{ connectionId: string }> };

const bodySchema = z.object({
  backfill: z.boolean().optional(),
});

/** Manually enqueue a performance sync for an ad connection in the active workspace. */
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { connectionId } = await params;
  const repo = await getAdConnectionRepository();
  const connection = await repo.getConnection(connectionId);
  if (!connection || connection.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (connection.status !== "active" || !connection.externalAccountId) {
    return NextResponse.json(
      { error: "Connection is not ready. Select an account first." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const job = await enqueueSyncAdPerformanceJob({
      workspaceId: active.workspace.id,
      createdBy: user.id,
      trigger: "api",
      input: {
        connectionId: connection.id,
        backfill: parsed.data.backfill,
      },
    });
    return NextResponse.json({ job });
  } catch (error) {
    logServerError("performance-sync:enqueue", error);
    return NextResponse.json(
      { error: unknownErrorMessage(error) },
      { status: 500 },
    );
  }
}
