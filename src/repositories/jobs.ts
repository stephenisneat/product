import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JobRun,
  JobRunStatus,
  JobRunTrigger,
  JobRunType,
} from "@/domain";

type DbJobRun = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  type: JobRunType;
  status: JobRunStatus;
  trigger_source: JobRunTrigger;
  trigger_run_id: string | null;
  created_by: string | null;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export function mapJobRun(row: DbJobRun): JobRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    type: row.type,
    status: row.status,
    trigger: row.trigger_source,
    triggerRunId: row.trigger_run_id,
    createdBy: row.created_by,
    input: (row.input ?? {}) as Record<string, unknown>,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export type JobRunCreateInput = {
  id?: string;
  workspaceId: string;
  productId?: string | null;
  type: JobRunType;
  trigger: JobRunTrigger;
  createdBy?: string | null;
  input?: Record<string, unknown>;
};

export type JobRunUpdateInput = {
  status?: JobRunStatus;
  triggerRunId?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export class SupabaseJobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: JobRunCreateInput): Promise<JobRun> {
    const { data, error } = await this.client
      .from("job_runs")
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        product_id: input.productId ?? null,
        type: input.type,
        status: "pending",
        trigger_source: input.trigger,
        created_by: input.createdBy ?? null,
        input: input.input ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapJobRun(data as DbJobRun);
  }

  async getById(id: string): Promise<JobRun | null> {
    const { data, error } = await this.client
      .from("job_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRun(data as DbJobRun) : null;
  }

  async listByWorkspace(
    workspaceId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<JobRun[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .from("job_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data as DbJobRun[]).map(mapJobRun);
  }

  async listNonTerminalForCreative(
    workspaceId: string,
    creativeId: string,
  ): Promise<JobRun[]> {
    const { data, error } = await this.client
      .from("job_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("status", ["pending", "running"])
      .contains("input", { creativeId });
    if (error) throw error;
    return (data as DbJobRun[]).map(mapJobRun);
  }

  async update(id: string, patch: JobRunUpdateInput): Promise<JobRun> {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.triggerRunId !== undefined) {
      row.trigger_run_id = patch.triggerRunId;
    }
    if (patch.result !== undefined) row.result = patch.result;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
    if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;

    const { data, error } = await this.client
      .from("job_runs")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapJobRun(data as DbJobRun);
  }
}
