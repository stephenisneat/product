import type {
  AdChannelProvider,
  AdConnection,
  ConnectionStatus,
} from "@/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdConnectionRecord = AdConnection & {
  refreshToken: string;
  accessToken: string | null;
  tokenExpiresAt: string | null;
};

type DbAdConnection = {
  id: string;
  workspace_id: string;
  provider: AdChannelProvider;
  external_account_id: string | null;
  login_customer_id: string | null;
  account_name: string;
  currency_code: string | null;
  time_zone: string | null;
  is_manager: boolean;
  refresh_token: string;
  access_token: string | null;
  token_expires_at: string | null;
  scope: string;
  status: ConnectionStatus;
  connected_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapAdConnection(row: DbAdConnection): AdConnectionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    externalAccountId: row.external_account_id,
    loginCustomerId: row.login_customer_id,
    accountName: row.account_name,
    currencyCode: row.currency_code,
    timeZone: row.time_zone,
    isManager: row.is_manager,
    refreshToken: row.refresh_token,
    accessToken: row.access_token,
    tokenExpiresAt: row.token_expires_at,
    scope: row.scope,
    status: row.status,
    connectedBy: row.connected_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublic(connection: AdConnectionRecord): AdConnection {
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    provider: connection.provider,
    externalAccountId: connection.externalAccountId,
    loginCustomerId: connection.loginCustomerId,
    accountName: connection.accountName,
    currencyCode: connection.currencyCode,
    timeZone: connection.timeZone,
    isManager: connection.isManager,
    scope: connection.scope,
    status: connection.status,
    connectedBy: connection.connectedBy,
    metadata: connection.metadata,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export interface AdConnectionRepository {
  listConnections(workspaceId: string): Promise<AdConnection[]>;
  getConnection(id: string): Promise<AdConnectionRecord | null>;
  getPendingConnection(
    workspaceId: string,
    provider?: AdChannelProvider,
  ): Promise<AdConnectionRecord | null>;
  listActiveByProvider(
    workspaceId: string,
    provider: AdChannelProvider,
  ): Promise<AdConnection[]>;
  /** Active connections with a linked account (service-role sync cron). */
  listAllActiveWithAccount(): Promise<AdConnection[]>;
  upsertConnection(connection: AdConnectionRecord): Promise<AdConnection>;
  updateTokens(
    id: string,
    tokens: { accessToken: string; tokenExpiresAt: string },
  ): Promise<void>;
  updateStatus(id: string, status: ConnectionStatus): Promise<void>;
  patchMetadata(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void>;
  deleteConnection(id: string): Promise<void>;
}

export class SupabaseAdConnectionRepository implements AdConnectionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listConnections(workspaceId: string): Promise<AdConnection[]> {
    const { data, error } = await this.client
      .from("ad_connections")
      .select(
        "id, workspace_id, provider, external_account_id, login_customer_id, account_name, currency_code, time_zone, is_manager, scope, status, connected_by, metadata, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Omit<
      DbAdConnection,
      "refresh_token" | "access_token" | "token_expires_at"
    >[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      externalAccountId: row.external_account_id,
      loginCustomerId: row.login_customer_id,
      accountName: row.account_name,
      currencyCode: row.currency_code,
      timeZone: row.time_zone,
      isManager: row.is_manager,
      scope: row.scope,
      status: row.status,
      connectedBy: row.connected_by,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getConnection(id: string): Promise<AdConnectionRecord | null> {
    const { data, error } = await this.client
      .from("ad_connections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAdConnection(data as DbAdConnection) : null;
  }

  async getPendingConnection(
    workspaceId: string,
    provider: AdChannelProvider = "google",
  ): Promise<AdConnectionRecord | null> {
    const { data, error } = await this.client
      .from("ad_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("status", "pending")
      .is("external_account_id", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAdConnection(data as DbAdConnection) : null;
  }

  async listActiveByProvider(
    workspaceId: string,
    provider: AdChannelProvider,
  ): Promise<AdConnection[]> {
    const { data, error } = await this.client
      .from("ad_connections")
      .select(
        "id, workspace_id, provider, external_account_id, login_customer_id, account_name, currency_code, time_zone, is_manager, scope, status, connected_by, metadata, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("status", "active")
      .not("external_account_id", "is", null)
      .order("account_name", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Omit<
      DbAdConnection,
      "refresh_token" | "access_token" | "token_expires_at"
    >[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      externalAccountId: row.external_account_id,
      loginCustomerId: row.login_customer_id,
      accountName: row.account_name,
      currencyCode: row.currency_code,
      timeZone: row.time_zone,
      isManager: row.is_manager,
      scope: row.scope,
      status: row.status,
      connectedBy: row.connected_by,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listAllActiveWithAccount(): Promise<AdConnection[]> {
    const { data, error } = await this.client
      .from("ad_connections")
      .select(
        "id, workspace_id, provider, external_account_id, login_customer_id, account_name, currency_code, time_zone, is_manager, scope, status, connected_by, metadata, created_at, updated_at",
      )
      .eq("status", "active")
      .not("external_account_id", "is", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Omit<
      DbAdConnection,
      "refresh_token" | "access_token" | "token_expires_at"
    >[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      externalAccountId: row.external_account_id,
      loginCustomerId: row.login_customer_id,
      accountName: row.account_name,
      currencyCode: row.currency_code,
      timeZone: row.time_zone,
      isManager: row.is_manager,
      scope: row.scope,
      status: row.status,
      connectedBy: row.connected_by,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async upsertConnection(
    connection: AdConnectionRecord,
  ): Promise<AdConnection> {
    let id = connection.id;
    let createdAt = connection.createdAt;

    if (connection.externalAccountId) {
      const { data: existing, error: lookupError } = await this.client
        .from("ad_connections")
        .select("id, created_at")
        .eq("workspace_id", connection.workspaceId)
        .eq("provider", connection.provider)
        .eq("external_account_id", connection.externalAccountId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        id = existing.id;
        createdAt = existing.created_at;
      }
    } else if (connection.status === "pending") {
      const { data: existing, error: lookupError } = await this.client
        .from("ad_connections")
        .select("id, created_at")
        .eq("workspace_id", connection.workspaceId)
        .eq("provider", connection.provider)
        .eq("status", "pending")
        .is("external_account_id", null)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        id = existing.id;
        createdAt = existing.created_at;
      }
    }

    const { error } = await this.client.from("ad_connections").upsert(
      {
        id,
        workspace_id: connection.workspaceId,
        provider: connection.provider,
        external_account_id: connection.externalAccountId,
        login_customer_id: connection.loginCustomerId ?? null,
        account_name: connection.accountName,
        currency_code: connection.currencyCode ?? null,
        time_zone: connection.timeZone ?? null,
        is_manager: connection.isManager,
        refresh_token: connection.refreshToken,
        access_token: connection.accessToken,
        token_expires_at: connection.tokenExpiresAt,
        scope: connection.scope,
        status: connection.status,
        connected_by: connection.connectedBy ?? null,
        metadata: connection.metadata ?? {},
        created_at: createdAt,
        updated_at: connection.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    return toPublic({
      ...connection,
      id,
      createdAt,
    });
  }

  async updateTokens(
    id: string,
    tokens: { accessToken: string; tokenExpiresAt: string },
  ): Promise<void> {
    const { error } = await this.client
      .from("ad_connections")
      .update({
        access_token: tokens.accessToken,
        token_expires_at: tokens.tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async updateStatus(id: string, status: ConnectionStatus): Promise<void> {
    const { error } = await this.client
      .from("ad_connections")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async patchMetadata(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.getConnection(id);
    if (!existing) throw new Error("Ad connection not found");
    const { error } = await this.client
      .from("ad_connections")
      .update({
        metadata: { ...existing.metadata, ...patch },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async deleteConnection(id: string): Promise<void> {
    const { error } = await this.client
      .from("ad_connections")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
