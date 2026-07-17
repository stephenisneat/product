import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WalletTransaction,
  WalletTransactionType,
  WorkspacePlan,
  WorkspaceWallet,
} from "@/domain";
import { getEntitlements } from "@/lib/billing/entitlements";

type DbWallet = {
  workspace_id: string;
  stripe_customer_id: string | null;
  balance_cents: number;
  currency: string;
  ad_spend_limit_cents: number | null;
  usage_limit_cents: number | null;
  usage_mtd_cents: number;
  ad_spend_mtd_cents: number;
  mtd_period_start: string;
  auto_reload_enabled: boolean;
  auto_reload_threshold_cents: number | null;
  auto_reload_target_cents: number | null;
  stripe_default_payment_method_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbTransaction = {
  id: string;
  workspace_id: string;
  type: WalletTransactionType;
  amount_cents: number;
  balance_after_cents: number;
  description: string;
  metadata: Record<string, unknown> | null;
  stripe_object_id: string | null;
  created_by: string | null;
  created_at: string;
};

export function mapWallet(row: DbWallet): WorkspaceWallet {
  return {
    workspaceId: row.workspace_id,
    stripeCustomerId: row.stripe_customer_id,
    balanceCents: Number(row.balance_cents),
    currency: row.currency,
    adSpendLimitCents:
      row.ad_spend_limit_cents == null ? null : Number(row.ad_spend_limit_cents),
    usageLimitCents:
      row.usage_limit_cents == null ? null : Number(row.usage_limit_cents),
    usageMtdCents: Number(row.usage_mtd_cents),
    adSpendMtdCents: Number(row.ad_spend_mtd_cents),
    mtdPeriodStart: row.mtd_period_start,
    autoReloadEnabled: row.auto_reload_enabled,
    autoReloadThresholdCents:
      row.auto_reload_threshold_cents == null
        ? null
        : Number(row.auto_reload_threshold_cents),
    autoReloadTargetCents:
      row.auto_reload_target_cents == null
        ? null
        : Number(row.auto_reload_target_cents),
    stripeDefaultPaymentMethodId: row.stripe_default_payment_method_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransaction(row: DbTransaction): WalletTransaction {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    amountCents: Number(row.amount_cents),
    balanceAfterCents: Number(row.balance_after_cents),
    description: row.description,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    stripeObjectId: row.stripe_object_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class SupabaseWalletRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getWallet(workspaceId: string): Promise<WorkspaceWallet | null> {
    const { data, error } = await this.client
      .from("workspace_wallets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapWallet(data as DbWallet);
  }

  async ensureWallet(workspaceId: string): Promise<WorkspaceWallet> {
    const existing = await this.getWallet(workspaceId);
    if (existing) {
      return this.refreshMtdIfNeeded(existing);
    }

    const { data, error } = await this.client
      .from("workspace_wallets")
      .insert({ workspace_id: workspaceId })
      .select("*")
      .single();
    if (error) {
      // Race: another request created it
      if (error.code === "23505") {
        const again = await this.getWallet(workspaceId);
        if (again) return this.refreshMtdIfNeeded(again);
      }
      throw error;
    }
    return mapWallet(data as DbWallet);
  }

  private async refreshMtdIfNeeded(
    wallet: WorkspaceWallet,
  ): Promise<WorkspaceWallet> {
    const currentPeriod = monthStartUtc();
    if (wallet.mtdPeriodStart >= currentPeriod) return wallet;

    const { data, error } = await this.client
      .from("workspace_wallets")
      .update({
        usage_mtd_cents: 0,
        ad_spend_mtd_cents: 0,
        mtd_period_start: currentPeriod,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", wallet.workspaceId)
      .select("*")
      .single();
    if (error) throw error;
    return mapWallet(data as DbWallet);
  }

  async setStripeCustomerId(
    workspaceId: string,
    stripeCustomerId: string,
  ): Promise<WorkspaceWallet> {
    const { data, error } = await this.client
      .from("workspace_wallets")
      .update({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (error) throw error;
    return mapWallet(data as DbWallet);
  }

  async updateLimits(
    workspaceId: string,
    limits: {
      adSpendLimitCents: number | null;
      usageLimitCents: number | null;
    },
  ): Promise<WorkspaceWallet> {
    const { data, error } = await this.client
      .from("workspace_wallets")
      .update({
        ad_spend_limit_cents: limits.adSpendLimitCents,
        usage_limit_cents: limits.usageLimitCents,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (error) throw error;
    return mapWallet(data as DbWallet);
  }

  async updateAutoReload(
    workspaceId: string,
    settings: {
      enabled: boolean;
      thresholdCents: number | null;
      targetCents: number | null;
    },
  ): Promise<WorkspaceWallet> {
    const { data, error } = await this.client
      .from("workspace_wallets")
      .update({
        auto_reload_enabled: settings.enabled,
        auto_reload_threshold_cents: settings.thresholdCents,
        auto_reload_target_cents: settings.targetCents,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (error) throw error;
    return mapWallet(data as DbWallet);
  }

  async setDefaultPaymentMethod(
    workspaceId: string,
    paymentMethodId: string | null,
  ): Promise<WorkspaceWallet> {
    const { data, error } = await this.client
      .from("workspace_wallets")
      .update({
        stripe_default_payment_method_id: paymentMethodId,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (error) throw error;
    return mapWallet(data as DbWallet);
  }

  async credit(input: {
    workspaceId: string;
    amountCents: number;
    type: Extract<
      WalletTransactionType,
      "credit_purchase" | "auto_reload" | "adjustment" | "refund"
    >;
    description?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
    stripeObjectId?: string | null;
  }): Promise<WalletTransaction> {
    const { data, error } = await this.client.rpc("credit_wallet", {
      p_workspace_id: input.workspaceId,
      p_amount_cents: input.amountCents,
      p_type: input.type,
      p_description: input.description ?? "",
      p_metadata: input.metadata ?? {},
      p_created_by: input.createdBy ?? null,
      p_stripe_object_id: input.stripeObjectId ?? null,
    });
    if (error) throw error;
    return mapTransaction(data as DbTransaction);
  }

  async debit(input: {
    workspaceId: string;
    amountCents: number;
    type: Extract<WalletTransactionType, "ai_usage" | "ad_spend" | "adjustment">;
    description?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
    stripeObjectId?: string | null;
  }): Promise<WalletTransaction> {
    const { data, error } = await this.client.rpc("debit_wallet", {
      p_workspace_id: input.workspaceId,
      p_amount_cents: input.amountCents,
      p_type: input.type,
      p_description: input.description ?? "",
      p_metadata: input.metadata ?? {},
      p_created_by: input.createdBy ?? null,
      p_stripe_object_id: input.stripeObjectId ?? null,
    });
    if (error) throw error;
    return mapTransaction(data as DbTransaction);
  }

  /**
   * Bill AI usage against the monthly included allotment first, then purchased
   * wallet balance (Hobby/Pro top-off). Free cannot overage.
   */
  async chargeAiUsage(input: {
    workspaceId: string;
    amountCents: number;
    includedAllotmentCents: number;
    allowOverage: boolean;
    description?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<WalletTransaction> {
    const { data, error } = await this.client.rpc("charge_ai_usage", {
      p_workspace_id: input.workspaceId,
      p_amount_cents: input.amountCents,
      p_included_allotment_cents: input.includedAllotmentCents,
      p_allow_overage: input.allowOverage,
      p_description: input.description ?? "",
      p_metadata: input.metadata ?? {},
      p_created_by: input.createdBy ?? null,
      p_stripe_object_id: null,
    });
    if (error) throw error;
    return mapTransaction(data as DbTransaction);
  }

  async listTransactions(
    workspaceId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<WalletTransaction[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .from("wallet_transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as DbTransaction[]).map(mapTransaction);
  }
}

function monthStartUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function nextMonthResetIso(mtdPeriodStart: string): string {
  const [y, m] = mtdPeriodStart.split("-").map(Number);
  // mtdPeriodStart is YYYY-MM-01 (m is 1–12). Date.UTC month is 0-indexed,
  // so passing `m` yields the first day of the following month.
  const next = new Date(Date.UTC(y, m, 1));
  return next.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * AI gate: included monthly allotment first, then purchased balance for paid
 * plans. Free hard-stops when the allotment is exhausted (no top-off).
 */
export function getWalletBlockedReason(
  wallet: WorkspaceWallet,
  plan: WorkspacePlan = "free",
) {
  const ents = getEntitlements(plan);
  const remainingIncluded = Math.max(
    0,
    ents.includedUsageCents - wallet.usageMtdCents,
  );

  if (
    wallet.usageLimitCents != null &&
    wallet.usageMtdCents >= wallet.usageLimitCents
  ) {
    return "usage_limit" as const;
  }

  if (remainingIncluded > 0) {
    return null;
  }

  // Included allotment exhausted.
  if (!ents.allowUsageTopOff) {
    return "usage_limit" as const;
  }

  if (wallet.balanceCents <= 0) {
    return "zero_balance" as const;
  }

  return null;
}

export function remainingIncludedUsageCents(
  wallet: WorkspaceWallet,
  plan: WorkspacePlan,
): number {
  const ents = getEntitlements(plan);
  return Math.max(0, ents.includedUsageCents - wallet.usageMtdCents);
}
