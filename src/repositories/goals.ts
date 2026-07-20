import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Goal,
  GoalHorizon,
  GoalMetric,
  GoalScope,
  GoalStatus,
} from "@/domain";

type DbGoal = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  scope: GoalScope;
  title: string;
  metric: GoalMetric;
  target_value: number | string | null;
  target_unit: string | null;
  horizon: GoalHorizon;
  status: GoalStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapGoal(row: DbGoal): Goal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    scope: row.scope,
    title: row.title,
    metric: row.metric,
    targetValue:
      row.target_value == null
        ? null
        : typeof row.target_value === "number"
          ? row.target_value
          : Number(row.target_value),
    targetUnit: row.target_unit,
    horizon: row.horizon,
    status: row.status,
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type GoalCreateInput = {
  id?: string;
  workspaceId: string;
  productId?: string | null;
  scope: GoalScope;
  title: string;
  metric?: GoalMetric;
  targetValue?: number | null;
  targetUnit?: string | null;
  horizon?: GoalHorizon;
  status?: GoalStatus;
  notes?: string;
  createdBy?: string | null;
};

export type GoalUpdateInput = {
  title?: string;
  metric?: GoalMetric;
  targetValue?: number | null;
  targetUnit?: string | null;
  horizon?: GoalHorizon;
  status?: GoalStatus;
  notes?: string;
};

export class SupabaseGoalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByWorkspace(
    workspaceId: string,
    opts: { status?: GoalStatus; limit?: number } = {},
  ): Promise<Goal[]> {
    const limit = opts.limit ?? 100;
    let query = this.client
      .from("goals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts.status) {
      query = query.eq("status", opts.status);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as DbGoal[]).map(mapGoal);
  }

  async listActiveByWorkspace(workspaceId: string): Promise<Goal[]> {
    return this.listByWorkspace(workspaceId, { status: "active" });
  }

  async getById(id: string): Promise<Goal | null> {
    const { data, error } = await this.client
      .from("goals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGoal(data as DbGoal) : null;
  }

  async create(input: GoalCreateInput): Promise<Goal> {
    const now = new Date().toISOString();
    const scope = input.scope;
    const productId = scope === "product" ? (input.productId ?? null) : null;
    if (scope === "product" && !productId) {
      throw new Error("productId is required for product-scoped goals.");
    }

    const { data, error } = await this.client
      .from("goals")
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        product_id: productId,
        scope,
        title: input.title,
        metric: input.metric ?? "custom",
        target_value: input.targetValue ?? null,
        target_unit: input.targetUnit ?? null,
        horizon: input.horizon ?? "ongoing",
        status: input.status ?? "active",
        notes: input.notes ?? "",
        created_by: input.createdBy ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapGoal(data as DbGoal);
  }

  async update(id: string, patch: GoalUpdateInput): Promise<Goal> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.metric !== undefined) row.metric = patch.metric;
    if (patch.targetValue !== undefined) row.target_value = patch.targetValue;
    if (patch.targetUnit !== undefined) row.target_unit = patch.targetUnit;
    if (patch.horizon !== undefined) row.horizon = patch.horizon;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.notes !== undefined) row.notes = patch.notes;

    const { data, error } = await this.client
      .from("goals")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapGoal(data as DbGoal);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("goals").delete().eq("id", id);
    if (error) throw error;
  }
}
