import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { cancelJobRun } from "@/lib/jobs/creative-job-controls";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { hasServiceRole } from "@/lib/supabase/service";
import { getJobRepository } from "@/repositories";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.literal("cancel"),
});

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { id } = await params;
  const jobs = await getJobRepository();
  const job = await jobs.getById(id);
  if (!job || job.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Jobs service is not configured." },
      { status: 503 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const { job, creative } = await cancelJobRun({
      workspaceId: active.workspace.id,
      jobRunId: id,
      reason: "Canceled by user",
    });
    return NextResponse.json({ job, creative });
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to cancel job.");
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logServerError("api.jobs.cancel", err, { jobRunId: id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
