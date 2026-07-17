import type {
  Artifact,
  BillingInterval,
  Campaign,
  CanonicalProduct,
  CommerceConnection,
  CommerceProvider,
  PerformancePoint,
  Product,
  ProductIntelligence,
  Workspace,
  WorkspaceInvite,
  WorkspaceInviteRole,
  WorkspaceMember,
  WorkspacePlan,
  WorkspaceRole,
} from "@/domain";

export type CommerceConnectionRecord = CommerceConnection & {
  accessToken: string;
};

export type WorkspaceWithRole = Workspace & {
  role: WorkspaceRole;
};

export type WorkspaceCreateInput = {
  name: string;
  createdBy: string;
  avatarUrl?: string | null;
  primaryDomain?: string | null;
  joinDomain?: string | null;
  domainJoinEnabled?: boolean;
  plan?: WorkspacePlan;
};

export type WorkspaceUpdateInput = {
  name?: string;
  avatarUrl?: string | null;
  plan?: WorkspacePlan;
  billingInterval?: BillingInterval | null;
  billedSeats?: number;
  primaryDomain?: string | null;
  joinDomain?: string | null;
  domainJoinEnabled?: boolean;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
};

export interface ProductRepository {
  listProducts(workspaceId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(product: Product): Promise<Product>;
  upsertImportedProduct(
    canonical: CanonicalProduct,
    workspaceId: string,
  ): Promise<Product>;
  getIntelligence(productId: string): Promise<ProductIntelligence | null>;
  upsertIntelligence(intelligence: ProductIntelligence): Promise<ProductIntelligence>;
  listCampaigns(productId: string): Promise<Campaign[]>;
  createCampaign(campaign: Campaign): Promise<Campaign>;
  updateCampaign(
    productId: string,
    campaignId: string,
    patch: Partial<Pick<Campaign, "name" | "status" | "channels" | "objective">>,
  ): Promise<Campaign>;
  getPerformance(productId: string): Promise<PerformancePoint[]>;
  listConnections(workspaceId: string): Promise<CommerceConnection[]>;
  getConnection(
    workspaceId: string,
    provider: CommerceProvider,
    shopDomain?: string,
  ): Promise<CommerceConnectionRecord | null>;
  upsertConnection(
    connection: CommerceConnectionRecord,
  ): Promise<CommerceConnection>;
}

export interface ArtifactRepository {
  listByProduct(productId: string): Promise<Artifact[]>;
  countCreativesByCampaign(campaignId: string): Promise<number>;
  getById(id: string): Promise<Artifact | null>;
  create(artifact: Artifact): Promise<Artifact>;
  update(artifact: Artifact): Promise<Artifact>;
}

export interface WorkspaceRepository {
  listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]>;
  getWorkspace(id: string): Promise<Workspace | null>;
  createWorkspace(input: WorkspaceCreateInput): Promise<Workspace>;
  updateWorkspace(id: string, input: WorkspaceUpdateInput): Promise<Workspace>;
  listDiscoverableWorkspaces(): Promise<Workspace[]>;
  joinWorkspaceByDomain(workspaceId: string): Promise<void>;
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  listInvites(workspaceId: string): Promise<WorkspaceInvite[]>;
  createInvite(input: {
    workspaceId: string;
    email: string;
    role: WorkspaceInviteRole;
    invitedBy: string;
    token: string;
    expiresAt: string;
  }): Promise<WorkspaceInvite>;
  revokeInvite(inviteId: string): Promise<void>;
  getInviteByToken(
    token: string,
  ): Promise<(WorkspaceInvite & { workspaceName: string }) | null>;
  acceptInvite(token: string, userId: string): Promise<WorkspaceMember>;
  setActiveWorkspace(userId: string, workspaceId: string): Promise<void>;
  getActiveWorkspaceId(userId: string): Promise<string | null>;
}

