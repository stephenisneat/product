import type {
  BillingInterval,
  Campaign,
  CanonicalProduct,
  CommerceConnection,
  CommerceProvider,
  Creative,
  CreativeExternalAdRefs,
  CreativeStage,
  CreativeStatus,
  AudioPayload,
  AudioScriptPayload,
  DisplayAssetsPayload,
  DisplayConceptPayload,
  JobRun,
  JobRunStatus,
  JobRunTrigger,
  JobRunType,
  PerformancePoint,
  Product,
  ProductIntelligence,
  ScreenplayPayload,
  SearchCopyPayload,
  SearchKeywordsPayload,
  StoryboardPayload,
  VideoPayload,
  WorldPayload,
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
  requireMfa?: boolean;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
};

export type ProductUpdateInput = {
  title?: string;
  description?: string;
  status?: Product["status"];
  price?: number;
  currency?: string;
  sku?: string | null;
  category?: string | null;
  images?: string[];
  imageAvgColors?: string[];
};

export interface ProductRepository {
  listProducts(workspaceId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(product: Product): Promise<Product>;
  updateProduct(id: string, patch: ProductUpdateInput): Promise<Product>;
  upsertImportedProduct(
    canonical: CanonicalProduct,
    workspaceId: string,
  ): Promise<Product>;
  getIntelligence(productId: string): Promise<ProductIntelligence | null>;
  upsertIntelligence(intelligence: ProductIntelligence): Promise<ProductIntelligence>;
  listCampaigns(productId: string): Promise<Campaign[]>;
  listCampaignsForProducts(productIds: string[]): Promise<Campaign[]>;
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


export type CreativeCreateInput = {
  id?: string;
  workspaceId: string;
  productId: string;
  campaignIds?: string[];
  kind?: Creative["kind"];
  title: string;
  brief: string;
  stage?: CreativeStage;
  status?: CreativeStatus;
  createdBy: string;
  activeJobId?: string | null;
};

export type CreativeUpdateInput = {
  title?: string;
  brief?: string;
  campaignIds?: string[];
  stage?: CreativeStage;
  status?: CreativeStatus;
  screenplay?: ScreenplayPayload | null;
  world?: WorldPayload | null;
  storyboard?: StoryboardPayload | null;
  video?: VideoPayload | null;
  concept?: DisplayConceptPayload | null;
  assets?: DisplayAssetsPayload | null;
  copy?: SearchCopyPayload | null;
  keywords?: SearchKeywordsPayload | null;
  script?: AudioScriptPayload | null;
  audio?: AudioPayload | null;
  revisionFeedback?: string | null;
  externalAdRefs?: CreativeExternalAdRefs;
  activeJobId?: string | null;
};

export interface CreativeRepository {
  listByWorkspace(
    workspaceId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<Creative[]>;
  listByProduct(productId: string): Promise<Creative[]>;
  listByCampaign(campaignId: string): Promise<Creative[]>;
  countByCampaign(campaignId: string): Promise<number>;
  countByWorkspace(
    workspaceId: string,
    status: CreativeStatus,
  ): Promise<number>;
  getById(id: string): Promise<Creative | null>;
  create(input: CreativeCreateInput): Promise<Creative>;
  update(id: string, patch: CreativeUpdateInput): Promise<Creative>;
  delete(id: string): Promise<void>;
  getCreativePerformance(creativeId: string): Promise<PerformancePoint[]>;
  upsertCreativePerformance(
    creativeId: string,
    points: PerformancePoint[],
  ): Promise<void>;
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

export interface JobRepository {
  create(input: JobRunCreateInput): Promise<JobRun>;
  getById(id: string): Promise<JobRun | null>;
  listByWorkspace(
    workspaceId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<JobRun[]>;
  /** Pending/running jobs whose input.creativeId matches. */
  listNonTerminalForCreative(
    workspaceId: string,
    creativeId: string,
  ): Promise<JobRun[]>;
  update(id: string, patch: JobRunUpdateInput): Promise<JobRun>;
}

