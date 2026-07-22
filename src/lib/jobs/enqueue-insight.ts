import { tasks } from "@trigger.dev/sdk";
import type {
  GenerateInsightJobInput,
  Insight,
  InsightTriggerSource,
  JobRun,
  JobRunTrigger,
} from "@/domain";
import { assertHasInsights } from "@/lib/billing/gates";
import { getEntitlements } from "@/lib/billing/entitlements";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { getInsightSettingsForWorkspace } from "@/lib/insights/insight-settings";
import {
  payloadFromGenerateInsightInput,
  runGenerateInsightJob,
} from "@/lib/jobs/generate-insight";
import {
  HEARTBEAT_MIN_HOURS_BETWEEN_INSIGHTS,
  MAX_AWAITING_REVIEW_INSIGHTS,
} from "@/lib/jobs/insight-stubs";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import {
  getGoalWriteRepository,
  getInsightWriteRepository,
  getJobWriteRepository,
  getWorkspaceWriteRepository,
} from "@/repositories";
import type { generateInsightTask } from "@/trigger/generate-insight";

function hasTriggerSecret(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export type EnqueueGenerateInsightInput = {
  workspaceId: string;
  createdBy: string | null;
  trigger: JobRunTrigger;
  input: GenerateInsightJobInput;
};

export async function enqueueGenerateInsightJob(
  opts: EnqueueGenerateInsightInput,
): Promise<JobRun> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  const jobs = getJobWriteRepository();
  const insights = getInsightWriteRepository();
  const run = await jobs.create({
    workspaceId: opts.workspaceId,
    productId: opts.input.productId ?? null,
    type: "generate_insight",
    trigger: opts.trigger,
    createdBy: opts.createdBy,
    input: opts.input,
  });

  await insights.update(opts.input.insightId, {
    status: "generating",
    activeJobId: run.id,
  });

  const payload = payloadFromGenerateInsightInput(
    run.id,
    opts.workspaceId,
    opts.createdBy,
    opts.input,
  );

  if (!hasTriggerSecret()) {
    void runGenerateInsightJob(payload).catch(() => {
      // Status is updated inside runGenerateInsightJob.
    });
    return run;
  }

  try {
    const handle = await tasks.trigger<typeof generateInsightTask>(
      "generate-insight",
      payload,
    );
    return jobs.update(run.id, { triggerRunId: handle.id });
  } catch (err) {
    const message = unknownErrorMessage(err, "Failed to trigger job.");
    logServerError("enqueueGenerateInsightJob.trigger", err, {
      jobRunId: run.id,
      insightId: opts.input.insightId,
    });
    await jobs.update(run.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    await insights.update(opts.input.insightId, {
      status: "failed",
      activeJobId: null,
    });
    throw new Error(message, { cause: err });
  }
}

export type StartInsightGenerationInput = {
  workspaceId: string;
  productId?: string | null;
  goalId?: string | null;
  campaignId?: string | null;
  createdBy?: string | null;
  /** Maps to insights.trigger_source */
  insightTrigger: InsightTriggerSource;
  /** Maps to job_runs.trigger_source */
  jobTrigger: JobRunTrigger;
  triggerRef?: Record<string, unknown> | null;
  sourceJobId?: string | null;
  revisionFeedback?: string | null;
  /** Skip plan gate (e.g. internal after job when already gated). */
  skipPlanGate?: boolean;
};

/**
 * Soft cap: refuse to enqueue when too many insights await review.
 */
export async function canEnqueueInsight(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const insights = getInsightWriteRepository();
  const awaiting = await insights.countByWorkspace(
    workspaceId,
    "awaiting_review",
  );
  if (awaiting >= MAX_AWAITING_REVIEW_INSIGHTS) {
    return {
      ok: false,
      reason: `Already have ${awaiting} insights awaiting review (max ${MAX_AWAITING_REVIEW_INSIGHTS}).`,
    };
  }
  return { ok: true };
}

export async function startInsightGeneration(
  opts: StartInsightGenerationInput,
): Promise<{ insight: Insight; job: JobRun }> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to enqueue jobs.",
    );
  }

  if (!opts.skipPlanGate) {
    const workspaces = getWorkspaceWriteRepository();
    const workspace = await workspaces.getWorkspace(opts.workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    assertHasInsights(workspace.plan ?? "free");
  }

  const cap = await canEnqueueInsight(opts.workspaceId);
  if (!cap.ok) {
    throw new Error(cap.reason);
  }

  const insights = getInsightWriteRepository();
  const triggerRef = {
    ...(opts.triggerRef ?? {}),
    ...(opts.sourceJobId ? { jobId: opts.sourceJobId } : {}),
  };

  const insight = await insights.create({
    workspaceId: opts.workspaceId,
    productId: opts.productId ?? null,
    campaignId: opts.campaignId ?? null,
    goalId: opts.goalId ?? null,
    status: "generating",
    triggerSource: opts.insightTrigger,
    triggerRef: Object.keys(triggerRef).length ? triggerRef : null,
    revisionFeedback: opts.revisionFeedback ?? null,
    createdBy: opts.createdBy ?? null,
  });

  try {
    const job = await enqueueGenerateInsightJob({
      workspaceId: opts.workspaceId,
      createdBy: opts.createdBy ?? null,
      trigger: opts.jobTrigger,
      input: {
        insightId: insight.id,
        productId: opts.productId ?? null,
        goalId: opts.goalId ?? null,
        sourceJobId: opts.sourceJobId ?? null,
        revisionFeedback: opts.revisionFeedback ?? null,
      },
    });
    const refreshed = await insights.getById(insight.id);
    return { insight: refreshed ?? insight, job };
  } catch (err) {
    await insights.update(insight.id, {
      status: "failed",
      activeJobId: null,
    });
    throw err;
  }
}

export async function resubmitInsight(opts: {
  workspaceId: string;
  insightId: string;
  createdBy: string | null;
  feedback?: string | null;
}): Promise<{ insight: Insight; job: JobRun }> {
  const insights = getInsightWriteRepository();
  const existing = await insights.getById(opts.insightId);
  if (!existing || existing.workspaceId !== opts.workspaceId) {
    throw new Error("Insight not found in workspace.");
  }
  if (
    existing.status === "rejected" ||
    existing.status === "generating"
  ) {
    throw new Error("Insight cannot be resubmitted in its current status.");
  }

  const feedback =
    opts.feedback?.trim() || existing.revisionFeedback?.trim() || null;

  await insights.update(existing.id, {
    status: "generating",
    revisionFeedback: feedback,
  });

  const job = await enqueueGenerateInsightJob({
    workspaceId: opts.workspaceId,
    createdBy: opts.createdBy,
    trigger: "agent",
    input: {
      insightId: existing.id,
      productId: existing.productId,
      goalId: existing.goalId,
      sourceJobId:
        existing.triggerRef && typeof existing.triggerRef.jobId === "string"
          ? existing.triggerRef.jobId
          : null,
      revisionFeedback: feedback,
    },
  });

  const refreshed = await insights.getById(existing.id);
  return { insight: refreshed ?? existing, job };
}

export type CreateReadyInsightInput = {
  workspaceId: string;
  productId: string;
  campaignId?: string | null;
  goalId?: string | null;
  createdBy: string | null;
  title: string;
  summary: string;
  rationale?: string;
  action: Insight["action"];
  triggerSource?: InsightTriggerSource;
  triggerRef?: Record<string, unknown> | null;
};

/**
 * Sync insight creation when the agent already has full content
 * (e.g. apply_deliverable with concrete copy). No generate_insight job.
 * Free plans may create apply_deliverable insights.
 */
export async function createReadyInsight(
  opts: CreateReadyInsightInput,
): Promise<Insight> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to create insights.",
    );
  }

  const action = opts.action;
  if (!action || action.type !== "apply_deliverable") {
    const workspaces = getWorkspaceWriteRepository();
    const workspace = await workspaces.getWorkspace(opts.workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    assertHasInsights(workspace.plan ?? "free");
  }

  const cap = await canEnqueueInsight(opts.workspaceId);
  if (!cap.ok) {
    throw new Error(cap.reason);
  }

  const insights = getInsightWriteRepository();
  return insights.create({
    workspaceId: opts.workspaceId,
    productId: opts.productId,
    campaignId: opts.campaignId ?? null,
    goalId: opts.goalId ?? null,
    title: opts.title,
    summary: opts.summary,
    rationale: opts.rationale ?? "",
    kind: "idea",
    status: "awaiting_review",
    triggerSource: opts.triggerSource ?? "agent",
    triggerRef: opts.triggerRef ?? null,
    action,
    createdBy: opts.createdBy,
  });
}

/**
 * After a campaign/creative job finishes, optionally enqueue an insight.
 * Best-effort: never throws to the caller.
 */
export async function maybeEnqueueInsightAfterJob(opts: {
  workspaceId: string;
  job: JobRun;
  createdBy?: string | null;
}): Promise<Insight | null> {
  try {
    if (!hasServiceRole()) return null;

    const workspaces = getWorkspaceWriteRepository();
    const workspace = await workspaces.getWorkspace(opts.workspaceId);
    if (!workspace) return null;
    if (!getEntitlements(workspace.plan ?? "free").hasInsights) return null;

    if (
      opts.job.status !== "succeeded" &&
      opts.job.status !== "failed"
    ) {
      return null;
    }

    if (opts.job.type === "generate_insight") {
      return null;
    }

    const insights = getInsightWriteRepository();
    const existing = await insights.findBySourceJobId(
      opts.workspaceId,
      opts.job.id,
    );
    if (existing) return null;

    const cap = await canEnqueueInsight(opts.workspaceId);
    if (!cap.ok) return null;

    const { insight } = await startInsightGeneration({
      workspaceId: opts.workspaceId,
      productId: opts.job.productId,
      createdBy: opts.createdBy ?? opts.job.createdBy,
      insightTrigger: "job",
      jobTrigger: "event",
      sourceJobId: opts.job.id,
      skipPlanGate: true,
    });
    return insight;
  } catch {
    return null;
  }
}

export async function maybeEnqueueHeartbeatInsight(opts: {
  workspaceId: string;
}): Promise<Insight | null> {
  try {
    if (!hasServiceRole()) return null;

    const workspaces = getWorkspaceWriteRepository();
    const workspace = await workspaces.getWorkspace(opts.workspaceId);
    if (!workspace) return null;
    if (!getEntitlements(workspace.plan ?? "free").hasInsights) return null;

    const settings = await getInsightSettingsForWorkspace(
      createServiceClient(),
      opts.workspaceId,
    );
    if (!settings.triggers.heartbeat) return null;
    if (settings.heartbeatSchedule === "off") return null;

    const goals = getGoalWriteRepository();
    const activeGoals = await goals.listActiveByWorkspace(opts.workspaceId);
    if (activeGoals.length === 0) return null;

    const insights = getInsightWriteRepository();
    const latest = await insights.latestCreatedAt(opts.workspaceId);
    if (latest) {
      const ageMs = Date.now() - new Date(latest).getTime();
      const minHours =
        settings.heartbeatSchedule === "weekly"
          ? 24 * 7
          : HEARTBEAT_MIN_HOURS_BETWEEN_INSIGHTS;
      const minMs = minHours * 60 * 60 * 1000;
      if (ageMs < minMs) return null;
    }

    const cap = await canEnqueueInsight(opts.workspaceId);
    if (!cap.ok) return null;

    const { insight } = await startInsightGeneration({
      workspaceId: opts.workspaceId,
      insightTrigger: "heartbeat",
      jobTrigger: "cron",
      createdBy: null,
      skipPlanGate: true,
    });
    return insight;
  } catch {
    return null;
  }
}
