import type {
  Artifact,
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
  WorkspaceRole,
} from "@/domain";

export type CommerceConnectionRecord = CommerceConnection & {
  accessToken: string;
};

export type WorkspaceWithRole = Workspace & {
  role: WorkspaceRole;
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
  getById(id: string): Promise<Artifact | null>;
  create(artifact: Artifact): Promise<Artifact>;
  update(artifact: Artifact): Promise<Artifact>;
}

export interface WorkspaceRepository {
  listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]>;
  getWorkspace(id: string): Promise<Workspace | null>;
  createWorkspace(name: string, createdBy: string): Promise<Workspace>;
  updateWorkspace(id: string, name: string): Promise<Workspace>;
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
