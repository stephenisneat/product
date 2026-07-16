import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Workspace,
  WorkspaceInvite,
  WorkspaceInviteRole,
  WorkspaceMember,
  WorkspacePlan,
  WorkspaceRole,
} from "@/domain";
import type {
  WorkspaceCreateInput,
  WorkspaceRepository,
  WorkspaceUpdateInput,
  WorkspaceWithRole,
} from "./types";

type DbWorkspace = {
  id: string;
  name: string;
  avatar_url: string | null;
  plan: WorkspacePlan;
  join_domain: string | null;
  domain_join_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DbMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profiles?: {
    email: string | null;
    full_name: string | null;
  } | null;
};

type DbInvite = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceInviteRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

function mapWorkspace(row: DbWorkspace): Workspace {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url ?? null,
    plan: row.plan ?? "free",
    joinDomain: row.join_domain ?? null,
    domainJoinEnabled: Boolean(row.domain_join_enabled),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: DbMember): WorkspaceMember {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    email: row.profiles?.email ?? undefined,
    name: row.profiles?.full_name ?? undefined,
  };
}

function mapInvite(row: DbInvite): WorkspaceInvite {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
    const { data, error } = await this.client
      .from("workspace_members")
      .select("role, workspaces(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return ((data ?? []) as unknown as {
      role: WorkspaceRole;
      workspaces: DbWorkspace | null;
    }[])
      .filter((row) => row.workspaces)
      .map((row) => ({
        ...mapWorkspace(row.workspaces as DbWorkspace),
        role: row.role,
      }));
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    const { data, error } = await this.client
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapWorkspace(data as DbWorkspace) : null;
  }

  async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("workspaces")
      .insert({
        name: input.name,
        created_by: input.createdBy,
        avatar_url: input.avatarUrl ?? null,
        plan: input.plan ?? "free",
        join_domain: input.joinDomain ?? null,
        domain_join_enabled: input.domainJoinEnabled ?? false,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) throw error;

    const workspace = mapWorkspace(data as DbWorkspace);

    const { error: memberError } = await this.client
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: input.createdBy,
        role: "owner",
        created_at: now,
      });
    if (memberError) throw memberError;

    return workspace;
  }

  async updateWorkspace(
    id: string,
    input: WorkspaceUpdateInput,
  ): Promise<Workspace> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (input.name !== undefined) patch.name = input.name;
    if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
    if (input.plan !== undefined) patch.plan = input.plan;
    if (input.joinDomain !== undefined) patch.join_domain = input.joinDomain;
    if (input.domainJoinEnabled !== undefined) {
      patch.domain_join_enabled = input.domainJoinEnabled;
    }

    const { data, error } = await this.client
      .from("workspaces")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapWorkspace(data as DbWorkspace);
  }

  async listDiscoverableWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await this.client.rpc(
      "list_discoverable_workspaces",
    );
    if (error) throw error;
    return ((data ?? []) as DbWorkspace[]).map(mapWorkspace);
  }

  async joinWorkspaceByDomain(workspaceId: string): Promise<void> {
    const { error } = await this.client.rpc("join_workspace_by_domain", {
      p_workspace_id: workspaceId,
    });
    if (error) throw error;
  }

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const { data, error } = await this.client
      .from("workspace_members")
      .select("workspace_id, user_id, role, created_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapMember(data as DbMember) : null;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await this.client
      .from("workspace_members")
      .select("workspace_id, user_id, role, created_at, profiles(email, full_name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as DbMember[]).map(mapMember);
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const { data, error } = await this.client
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .select("workspace_id, user_id, role, created_at, profiles(email, full_name)")
      .single();
    if (error) throw error;
    return mapMember(data as unknown as DbMember);
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  async listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    const { data, error } = await this.client
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as DbInvite[]).map(mapInvite);
  }

  async createInvite(input: {
    workspaceId: string;
    email: string;
    role: WorkspaceInviteRole;
    invitedBy: string;
    token: string;
    expiresAt: string;
  }): Promise<WorkspaceInvite> {
    const { data, error } = await this.client
      .from("workspace_invites")
      .insert({
        workspace_id: input.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        token: input.token,
        invited_by: input.invitedBy,
        expires_at: input.expiresAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapInvite(data as DbInvite);
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await this.client
      .from("workspace_invites")
      .delete()
      .eq("id", inviteId)
      .is("accepted_at", null);
    if (error) throw error;
  }

  async getInviteByToken(token: string): Promise<
    | (WorkspaceInvite & { workspaceName: string })
    | null
  > {
    const { data, error } = await this.client.rpc("peek_workspace_invite", {
      p_token: token,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      email: row.email,
      role: row.role,
      token,
      invitedBy: "",
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at ?? undefined,
      createdAt: row.expires_at,
    };
  }

  async acceptInvite(token: string, userId: string): Promise<WorkspaceMember> {
    const { data: workspaceId, error } = await this.client.rpc(
      "accept_workspace_invite",
      { p_token: token },
    );
    if (error) throw error;

    const membership = await this.getMembership(workspaceId as string, userId);
    if (!membership) {
      throw new Error("Membership not found after accepting invite");
    }
    return membership;
  }

  async setActiveWorkspace(userId: string, workspaceId: string): Promise<void> {
    const { error } = await this.client
      .from("profiles")
      .update({ active_workspace_id: workspaceId })
      .eq("id", userId);
    if (error) throw error;
  }

  async getActiveWorkspaceId(userId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.active_workspace_id as string | null) ?? null;
  }
}
