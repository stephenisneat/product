import { z } from "zod";

export const productStatusSchema = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const commerceProviderSchema = z.enum([
  "shopify",
  "woocommerce",
  "bigcommerce",
  "amazon",
  "squarespace",
]);
export type CommerceProvider = z.infer<typeof commerceProviderSchema>;

export const adChannelProviderSchema = z.enum([
  "google",
  "meta",
  "tiktok",
  "amazon",
  "x",
]);
export type AdChannelProvider = z.infer<typeof adChannelProviderSchema>;

export const connectionStatusSchema = z.enum([
  "active",
  "disconnected",
  "error",
  "pending",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** Advertising channels supported for Google Ads campaign types. */
export const googleAdsChannelTypeSchema = z.enum([
  "SEARCH",
  "DISPLAY",
  "VIDEO",
]);
export type GoogleAdsChannelType = z.infer<typeof googleAdsChannelTypeSchema>;

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceInviteRoleSchema = z.enum(["admin", "member"]);
export type WorkspaceInviteRole = z.infer<typeof workspaceInviteRoleSchema>;

export const workspacePlanSchema = z.enum(["free", "growth", "pro"]);
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;

export const billingIntervalSchema = z.enum(["month", "year"]);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  plan: workspacePlanSchema.default("free"),
  billingInterval: billingIntervalSchema.nullable().optional(),
  billedSeats: z.number().int().positive().default(1),
  primaryDomain: z.string().nullable().optional(),
  joinDomain: z.string().nullable().optional(),
  domainJoinEnabled: z.boolean().default(false),
  requireMfa: z.boolean().default(false),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string(),
  role: workspaceRoleSchema,
  createdAt: z.string().datetime(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceInviteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: workspaceInviteRoleSchema,
  token: z.string().min(1),
  invitedBy: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type WorkspaceInvite = z.infer<typeof workspaceInviteSchema>;

export const commerceConnectionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: commerceProviderSchema,
  shopDomain: z.string().min(1),
  scope: z.string().default(""),
  status: connectionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CommerceConnection = z.infer<typeof commerceConnectionSchema>;

export const adConnectionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: adChannelProviderSchema,
  externalAccountId: z.string().nullable(),
  loginCustomerId: z.string().nullable().optional(),
  accountName: z.string().default(""),
  currencyCode: z.string().nullable().optional(),
  timeZone: z.string().nullable().optional(),
  isManager: z.boolean().default(false),
  scope: z.string().default(""),
  status: connectionStatusSchema,
  connectedBy: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AdConnection = z.infer<typeof adConnectionSchema>;

export const productOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string().min(1),
  position: z.number().int().nonnegative(),
});

export type ProductOption = z.infer<typeof productOptionSchema>;

export const inventoryLevelSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int(),
  tracked: z.boolean().default(true),
  updatedAt: z.string().datetime(),
});

export type InventoryLevel = z.infer<typeof inventoryLevelSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  title: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  currency: z.string().default("USD"),
  optionValues: z.record(z.string(), z.string()).default({}),
  position: z.number().int().nonnegative().default(0),
  sourceVariantId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  inventory: inventoryLevelSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;

export const collectionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string().min(1),
  handle: z.string().min(1),
  sourceProvider: commerceProviderSchema.optional(),
  sourceCollectionId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const imageAvgColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb color");

export const productTypeSchema = z.enum([
  "ecommerce",
  "mobile_app",
  "website",
  "brick_and_mortar",
  "event",
  "election",
]);
export type ProductType = z.infer<typeof productTypeSchema>;

export const ecommerceMetadataSchema = z.object({
  fulfillmentKind: z.enum(["physical", "digital"]),
});
export type EcommerceMetadata = z.infer<typeof ecommerceMetadataSchema>;

export const mobileAppPlatformSchema = z.enum(["ios", "android", "web"]);
export type MobileAppPlatform = z.infer<typeof mobileAppPlatformSchema>;

export const mobileAppMetadataSchema = z.object({
  platforms: z.array(mobileAppPlatformSchema).min(1),
  appStoreUrl: z.string().url().optional(),
  playStoreUrl: z.string().url().optional(),
  bundleId: z.string().optional(),
  category: z.string().optional(),
});
export type MobileAppMetadata = z.infer<typeof mobileAppMetadataSchema>;

export const websiteSiteKindSchema = z.enum([
  "marketing",
  "saas",
  "content",
  "other",
]);
export type WebsiteSiteKind = z.infer<typeof websiteSiteKindSchema>;

export const websiteMetadataSchema = z.object({
  url: z.string().url(),
  primaryDomain: z.string().optional(),
  siteKind: websiteSiteKindSchema.optional(),
});
export type WebsiteMetadata = z.infer<typeof websiteMetadataSchema>;

export const brickAndMortarMetadataSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
  hours: z.string().optional(),
  websiteUrl: z.string().url().optional(),
});
export type BrickAndMortarMetadata = z.infer<typeof brickAndMortarMetadataSchema>;

export const eventMetadataSchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().optional(),
  venue: z.string().min(1),
  address: z.string().optional(),
  ticketUrl: z.string().url().optional(),
  capacity: z.number().int().positive().optional(),
});
export type EventMetadata = z.infer<typeof eventMetadataSchema>;

export const electionMetadataSchema = z.object({
  electionDate: z.string().min(1),
  jurisdiction: z.string().min(1),
  office: z.string().min(1),
  candidateName: z.string().min(1),
  party: z.string().optional(),
});
export type ElectionMetadata = z.infer<typeof electionMetadataSchema>;

export const productTypeMetadataSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ecommerce"), metadata: ecommerceMetadataSchema }),
  z.object({ type: z.literal("mobile_app"), metadata: mobileAppMetadataSchema }),
  z.object({ type: z.literal("website"), metadata: websiteMetadataSchema }),
  z.object({
    type: z.literal("brick_and_mortar"),
    metadata: brickAndMortarMetadataSchema,
  }),
  z.object({ type: z.literal("event"), metadata: eventMetadataSchema }),
  z.object({ type: z.literal("election"), metadata: electionMetadataSchema }),
]);

const productSharedSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  handle: z.string().min(1),
  description: z.string(),
  status: productStatusSchema,
  price: z.number().nonnegative(),
  currency: z.string().default("USD"),
  images: z.array(z.string().url()).default([]),
  /** Parallel to `images` — average opaque pixel as #rrggbb. */
  imageAvgColors: z.array(imageAvgColorSchema).default([]),
  channels: z.array(z.string()).default([]),
  sku: z.string().optional(),
  category: z.string().optional(),
  sourceProvider: commerceProviderSchema.optional(),
  sourceProductId: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  workspaceId: z.string(),
  options: z.array(productOptionSchema).optional(),
  variants: z.array(productVariantSchema).optional(),
  collections: z.array(collectionSchema).optional(),
});

export const productSchema = productSharedSchema.and(productTypeMetadataSchema);

export type Product = z.infer<typeof productSchema>;
export type ProductMetadata = Product["metadata"];

/** Provider-agnostic payload used by commerce importers. */
export const canonicalProductSchema = z.object({
  sourceProvider: commerceProviderSchema,
  sourceProductId: z.string().min(1),
  title: z.string().min(1),
  handle: z.string().min(1),
  description: z.string().default(""),
  status: productStatusSchema,
  images: z.array(z.string().url()).default([]),
  imageAvgColors: z.array(imageAvgColorSchema).default([]),
  options: z.array(
    z.object({
      name: z.string().min(1),
      position: z.number().int().nonnegative(),
    }),
  ),
  variants: z.array(
    z.object({
      sourceVariantId: z.string().min(1),
      title: z.string().min(1),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      price: z.number().nonnegative(),
      compareAtPrice: z.number().nonnegative().optional(),
      currency: z.string().min(1),
      optionValues: z.record(z.string(), z.string()).default({}),
      position: z.number().int().nonnegative().default(0),
      imageUrl: z.string().url().optional(),
      inventoryQuantity: z.number().int().default(0),
      inventoryTracked: z.boolean().default(true),
    }),
  ),
  collections: z
    .array(
      z.object({
        sourceCollectionId: z.string().min(1),
        title: z.string().min(1),
        handle: z.string().min(1),
      }),
    )
    .default([]),
});

export type CanonicalProduct = z.infer<typeof canonicalProductSchema>;

const createProductSharedSchema = z.object({
  id: z
    .string()
    .regex(/^prod_[a-z0-9]+$/, "Invalid product id")
    .optional(),
  title: z.string().min(1, "Title is required"),
  handle: z
    .string()
    .min(1, "Handle is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens",
    ),
  description: z.string().default(""),
  status: productStatusSchema.default("draft"),
  images: z.array(z.string().url()).default([]),
  imageAvgColors: z.array(imageAvgColorSchema).default([]),
});

export const createProductInputSchema = z.discriminatedUnion("type", [
  createProductSharedSchema.extend({
    type: z.literal("ecommerce"),
    price: z.number().nonnegative("Price must be 0 or greater"),
    currency: z.string().min(1).default("USD"),
    sku: z.string().optional(),
    category: z.string().optional(),
    metadata: ecommerceMetadataSchema,
  }),
  createProductSharedSchema.extend({
    type: z.literal("mobile_app"),
    metadata: mobileAppMetadataSchema,
  }),
  createProductSharedSchema.extend({
    type: z.literal("website"),
    metadata: websiteMetadataSchema,
  }),
  createProductSharedSchema.extend({
    type: z.literal("brick_and_mortar"),
    metadata: brickAndMortarMetadataSchema,
  }),
  createProductSharedSchema.extend({
    type: z.literal("event"),
    metadata: eventMetadataSchema,
  }),
  createProductSharedSchema.extend({
    type: z.literal("election"),
    metadata: electionMetadataSchema,
  }),
]);

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const productIntelligenceSchema = z.object({
  productId: z.string(),
  positioning: z.string(),
  audience: z.string(),
  valueProps: z.array(z.string()),
  objections: z.array(z.string()),
  tone: z.string(),
  updatedAt: z.string().datetime(),
});

export type ProductIntelligence = z.infer<typeof productIntelligenceSchema>;

export const artifactTypeSchema = z.enum([
  "positioning",
  "ad_copy",
  "campaign_concept",
  "listing_update",
]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactStatusSchema = z.enum(["proposed", "approved", "rejected"]);
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;

export const positioningPayloadSchema = z.object({
  positioning: z.string(),
  audience: z.string(),
  valueProps: z.array(z.string()),
  objections: z.array(z.string()),
  tone: z.string(),
});

export const adCopyPayloadSchema = z.object({
  headline: z.string(),
  primaryText: z.string(),
  cta: z.string(),
  channel: z.string(),
});

export const campaignConceptPayloadSchema = z.object({
  name: z.string(),
  objective: z.string(),
  channels: z.array(z.string()),
  angles: z.array(z.string()),
});

export const listingUpdatePayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  bulletPoints: z.array(z.string()),
});

export const artifactPayloadSchema = z.union([
  positioningPayloadSchema,
  adCopyPayloadSchema,
  campaignConceptPayloadSchema,
  listingUpdatePayloadSchema,
]);

export const artifactSchema = z.object({
  id: z.string(),
  productId: z.string(),
  campaignIds: z.array(z.string()).default([]),
  type: artifactTypeSchema,
  status: artifactStatusSchema,
  title: z.string(),
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Artifact = z.infer<typeof artifactSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  status: z.enum(["draft", "active", "paused"]),
  channels: z.array(z.string()),
  objective: z.string(),
  updatedAt: z.string().datetime(),
});

export type Campaign = z.infer<typeof campaignSchema>;

export const performancePointSchema = z.object({
  date: z.string(),
  impressions: z.number(),
  clicks: z.number(),
  spend: z.number(),
  conversions: z.number(),
  revenue: z.number(),
});

export type PerformancePoint = z.infer<typeof performancePointSchema>;

export const visualizationKindSchema = z.enum([
  "sankey",
  "timeseries",
  "comparison",
  "bar",
]);
export type VisualizationKind = z.infer<typeof visualizationKindSchema>;

export const sankeyNodeSchema = z.object({
  name: z.string(),
});
export const sankeyLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  value: z.number(),
});
export const sankeyDataSchema = z.object({
  nodes: z.array(sankeyNodeSchema),
  links: z.array(sankeyLinkSchema),
});
export type SankeyData = z.infer<typeof sankeyDataSchema>;

/** Chart point with a primary value plus any extra numeric metrics coming through. */
export const vizPointSchema = z
  .object({
    date: z.string(),
    value: z.number(),
  })
  .passthrough();

export const timeseriesSeriesSchema = z.object({
  name: z.string(),
  points: z.array(vizPointSchema),
});
export const timeseriesDataSchema = z.object({
  metric: z.string(),
  series: z.array(timeseriesSeriesSchema),
});
export type TimeseriesData = z.infer<typeof timeseriesDataSchema>;

export const comparisonDataSchema = z.object({
  metric: z.string(),
  series: z.array(
    z.object({
      name: z.string(),
      points: z.array(vizPointSchema),
    }),
  ),
});
export type ComparisonData = z.infer<typeof comparisonDataSchema>;

export const barDataSchema = z.object({
  metric: z.string(),
  categories: z.array(z.string()),
  series: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.number()),
    }),
  ),
});
export type BarData = z.infer<typeof barDataSchema>;

export const visualizationDataSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sankey"), data: sankeyDataSchema }),
  z.object({ kind: z.literal("timeseries"), data: timeseriesDataSchema }),
  z.object({ kind: z.literal("comparison"), data: comparisonDataSchema }),
  z.object({ kind: z.literal("bar"), data: barDataSchema }),
]);

export const visualizationSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: visualizationKindSchema,
  prompt: z.string().optional(),
  data: z.union([
    sankeyDataSchema,
    timeseriesDataSchema,
    comparisonDataSchema,
    barDataSchema,
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Visualization = z.infer<typeof visualizationSchema>;

export const appUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type AppUser = z.infer<typeof appUserSchema>;

export const adminFeedbackKindSchema = z.enum(["channel_request"]);
export type AdminFeedbackKind = z.infer<typeof adminFeedbackKindSchema>;

export const createAdminFeedbackSchema = z.object({
  kind: adminFeedbackKindSchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
});
export type CreateAdminFeedbackInput = z.infer<typeof createAdminFeedbackSchema>;

export const adminFeedbackSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().nullable(),
  kind: adminFeedbackKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminFeedback = z.infer<typeof adminFeedbackSchema>;

export const notificationPreferencesSchema = z.object({
  productUpdates: z.boolean(),
  jobCompletions: z.boolean(),
  creativeReview: z.boolean(),
  workspaceInvites: z.boolean(),
  billingAlerts: z.boolean(),
  marketing: z.boolean(),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  productUpdates: true,
  jobCompletions: true,
  creativeReview: true,
  workspaceInvites: true,
  billingAlerts: true,
  marketing: false,
};

export const insightGoalModeSchema = z.enum(["auto", "manual"]);
export type InsightGoalMode = z.infer<typeof insightGoalModeSchema>;

export const insightHeartbeatScheduleSchema = z.enum([
  "daily",
  "weekly",
  "off",
]);
export type InsightHeartbeatSchedule = z.infer<
  typeof insightHeartbeatScheduleSchema
>;

export const insightSettingsSchema = z.object({
  goalMode: insightGoalModeSchema,
  triggers: z.object({
    job: z.boolean(),
    agent: z.boolean(),
    heartbeat: z.boolean(),
    api: z.boolean(),
  }),
  heartbeatSchedule: insightHeartbeatScheduleSchema,
});
export type InsightSettings = z.infer<typeof insightSettingsSchema>;

export const DEFAULT_INSIGHT_SETTINGS: InsightSettings = {
  goalMode: "auto",
  triggers: {
    job: true,
    agent: true,
    heartbeat: true,
    api: true,
  },
  heartbeatSchedule: "daily",
};
export const walletTransactionTypeSchema = z.enum([
  "credit_purchase",
  "auto_reload",
  "ai_usage",
  "ad_spend",
  "adjustment",
  "refund",
]);
export type WalletTransactionType = z.infer<typeof walletTransactionTypeSchema>;

export const workspaceWalletSchema = z.object({
  workspaceId: z.string().uuid(),
  stripeCustomerId: z.string().nullable(),
  balanceCents: z.number().int().nonnegative(),
  currency: z.string(),
  adSpendLimitCents: z.number().int().nonnegative().nullable(),
  usageLimitCents: z.number().int().nonnegative().nullable(),
  usageMtdCents: z.number().int().nonnegative(),
  adSpendMtdCents: z.number().int().nonnegative(),
  actionsMtd: z.number().int().nonnegative(),
  includedRolloverCents: z.number().int().nonnegative(),
  mtdPeriodStart: z.string(),
  autoReloadEnabled: z.boolean(),
  autoReloadThresholdCents: z.number().int().nonnegative().nullable(),
  autoReloadTargetCents: z.number().int().nonnegative().nullable(),
  stripeDefaultPaymentMethodId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkspaceWallet = z.infer<typeof workspaceWalletSchema>;

export const walletTransactionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  type: walletTransactionTypeSchema,
  amountCents: z.number().int(),
  balanceAfterCents: z.number().int().nonnegative(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  stripeObjectId: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type WalletTransaction = z.infer<typeof walletTransactionSchema>;

export const walletBlockedReasonSchema = z.enum([
  "zero_balance",
  "usage_limit",
]);
export type WalletBlockedReason = z.infer<typeof walletBlockedReasonSchema>;

export const walletSummarySchema = z.object({
  balanceCents: z.number().int().nonnegative(),
  currency: z.string(),
  adSpendLimitCents: z.number().int().nonnegative().nullable(),
  usageLimitCents: z.number().int().nonnegative().nullable(),
  usageMtdCents: z.number().int().nonnegative(),
  adSpendMtdCents: z.number().int().nonnegative(),
  actionsMtd: z.number().int().nonnegative(),
  includedRolloverCents: z.number().int().nonnegative(),
  includedActions: z.number().int().nonnegative().nullable(),
  resetsOn: z.string(),
  autoReloadEnabled: z.boolean(),
  autoReloadThresholdCents: z.number().int().nonnegative().nullable(),
  autoReloadTargetCents: z.number().int().nonnegative().nullable(),
  hasPaymentMethod: z.boolean(),
  blocked: z.boolean(),
  blockedReason: walletBlockedReasonSchema.nullable(),
  canManage: z.boolean(),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;

/** Per-member AI usage for the current workspace billing period. */
export const memberUsageSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().url().nullable().optional(),
  usageCents: z.number().int().nonnegative(),
  actionCount: z.number().int().nonnegative(),
});
export type MemberUsage = z.infer<typeof memberUsageSchema>;

export const creativeKindSchema = z.enum(["video_ad", "display_ad"]);
export type CreativeKind = z.infer<typeof creativeKindSchema>;

export const creativeStageSchema = z.enum([
  "screenplay",
  "storyboard",
  "video",
  "concept",
  "assets",
]);
export type CreativeStage = z.infer<typeof creativeStageSchema>;

export const creativeStatusSchema = z.enum([
  "generating",
  "awaiting_review",
  "revising",
  "paused",
  "rejected",
  "ready",
]);
export type CreativeStatus = z.infer<typeof creativeStatusSchema>;

export const screenplaySpokenKindSchema = z.enum(["voiceover", "dialogue"]);
export type ScreenplaySpokenKind = z.infer<typeof screenplaySpokenKindSchema>;

export const screenplaySceneSchema = z.object({
  id: z.string(),
  heading: z.string(),
  /** Concrete visual direction — who/what/where, never abstract marketing language. */
  action: z.string(),
  /** Empty string = no spoken audio in this scene. */
  dialogue: z.string().default(""),
  /**
   * How dialogue is delivered. Ignored when dialogue is empty.
   * Defaults to voiceover for backwards-compatible payloads.
   */
  spokenKind: screenplaySpokenKindSchema.default("voiceover"),
  /** On-screen character name when spokenKind is "dialogue". */
  character: z.string().default(""),
  durationSec: z.number().positive(),
});
export type ScreenplayScene = z.infer<typeof screenplaySceneSchema>;

export const screenplayPayloadSchema = z.object({
  logline: z.string(),
  script: z.string(),
  scenes: z.array(screenplaySceneSchema),
  aspectRatio: z.string().default("9:16"),
  targetDurationSec: z.number().positive().default(15),
});
export type ScreenplayPayload = z.infer<typeof screenplayPayloadSchema>;

export const storyboardFrameSchema = z.object({
  sceneId: z.string(),
  shotDescription: z.string(),
  camera: z.string(),
  imageUrl: z.string().url(),
});
export type StoryboardFrame = z.infer<typeof storyboardFrameSchema>;

export const storyboardPayloadSchema = z.object({
  styleBrief: z.string(),
  frames: z.array(storyboardFrameSchema),
});
export type StoryboardPayload = z.infer<typeof storyboardPayloadSchema>;

export const videoClipSchema = z.object({
  sceneId: z.string(),
  url: z.string().url(),
  audioUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSec: z.number().positive(),
  /** Original clip length for trim caps in the editor. */
  sourceDurationSec: z.number().positive().optional(),
  prompt: z.string().optional(),
  /** Spoken caption text for this clip (from screenplay dialogue). */
  caption: z.string().default(""),
});
export type VideoClip = z.infer<typeof videoClipSchema>;

export const videoPayloadSchema = z.object({
  url: z.string().url(),
  thumbnailUrl: z.string().url(),
  durationSec: z.number().positive(),
  aspectRatio: z.string().default("9:16"),
  /** Per-scene Veo clips used by the timeline editor / Remotion composition. */
  clips: z.array(videoClipSchema).default([]),
  /** Product title for Remotion end card. */
  productTitle: z.string().optional(),
});
export type VideoPayload = z.infer<typeof videoPayloadSchema>;

/** RDA-shaped copy + image direction for display_ad concept stage. */
export const displayConceptPayloadSchema = z.object({
  headlines: z.array(z.string().trim().min(1).max(30)).min(1).max(5),
  longHeadline: z.string().trim().min(1).max(90),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(1).max(5),
  businessName: z.string().trim().min(1).max(25),
  styleBrief: z.string().trim().min(1),
  imagePrompts: z.object({
    marketing: z.string().trim().min(1),
    square: z.string().trim().min(1),
  }),
});
export type DisplayConceptPayload = z.infer<typeof displayConceptPayloadSchema>;

/** Sized marketing images for display_ad assets stage. */
export const displayAssetsPayloadSchema = z.object({
  marketingImageUrl: z.string().url(),
  squareImageUrl: z.string().url(),
});
export type DisplayAssetsPayload = z.infer<typeof displayAssetsPayloadSchema>;

export const creativeExternalAdRefsSchema = z.object({
  googleAssetId: z.string().trim().min(1).optional(),
  metaAdId: z.string().trim().min(1).optional(),
  tiktokAdId: z.string().trim().min(1).optional(),
});
export type CreativeExternalAdRefs = z.infer<
  typeof creativeExternalAdRefsSchema
>;

export const creativeSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string(),
  campaignIds: z.array(z.string()).default([]),
  kind: creativeKindSchema,
  title: z.string(),
  brief: z.string(),
  stage: creativeStageSchema,
  status: creativeStatusSchema,
  screenplay: screenplayPayloadSchema.nullable(),
  storyboard: storyboardPayloadSchema.nullable(),
  video: videoPayloadSchema.nullable(),
  concept: displayConceptPayloadSchema.nullable(),
  assets: displayAssetsPayloadSchema.nullable(),
  revisionFeedback: z.string().nullable(),
  externalAdRefs: creativeExternalAdRefsSchema.default({}),
  activeJobId: z.string().uuid().nullable(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Creative = z.infer<typeof creativeSchema>;

export const goalScopeSchema = z.enum(["workspace", "product"]);
export type GoalScope = z.infer<typeof goalScopeSchema>;

export const goalMetricSchema = z.enum([
  "roas",
  "cac",
  "revenue",
  "conversions",
  "custom",
]);
export type GoalMetric = z.infer<typeof goalMetricSchema>;

export const goalHorizonSchema = z.enum([
  "weekly",
  "monthly",
  "quarterly",
  "ongoing",
]);
export type GoalHorizon = z.infer<typeof goalHorizonSchema>;

export const goalStatusSchema = z.enum([
  "active",
  "paused",
  "achieved",
  "archived",
]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().nullable(),
  scope: goalScopeSchema,
  title: z.string(),
  metric: goalMetricSchema,
  targetValue: z.number().nullable(),
  targetUnit: z.string().nullable(),
  horizon: goalHorizonSchema,
  status: goalStatusSchema,
  notes: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Goal = z.infer<typeof goalSchema>;

export const insightStatusSchema = z.enum([
  "generating",
  "awaiting_review",
  "revising",
  "accepted",
  "rejected",
  "failed",
]);
export type InsightStatus = z.infer<typeof insightStatusSchema>;

export const insightTriggerSourceSchema = z.enum([
  "job",
  "agent",
  "heartbeat",
  "api",
]);
export type InsightTriggerSource = z.infer<typeof insightTriggerSourceSchema>;

export const insightActionTypeSchema = z.enum([
  "create_campaign",
  "propose_artifact",
  "create_video_creative",
  "open_chat",
]);
export type InsightActionType = z.infer<typeof insightActionTypeSchema>;

export const insightActionSchema = z.object({
  type: insightActionTypeSchema,
  label: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type InsightAction = z.infer<typeof insightActionSchema>;

export const insightSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().nullable(),
  campaignId: z.string().nullable(),
  goalId: z.string().uuid().nullable(),
  title: z.string(),
  summary: z.string(),
  rationale: z.string(),
  status: insightStatusSchema,
  triggerSource: insightTriggerSourceSchema,
  triggerRef: z.record(z.string(), z.unknown()).nullable(),
  action: insightActionSchema.nullable(),
  revisionFeedback: z.string().nullable(),
  activeJobId: z.string().uuid().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Insight = z.infer<typeof insightSchema>;

export const jobRunTypeSchema = z.enum([
  "create_campaign",
  "generate_creative_screenplay",
  "generate_creative_storyboard",
  "generate_creative_video",
  "generate_creative_concept",
  "generate_creative_assets",
  "render_creative_video",
  "generate_insight",
]);
export type JobRunType = z.infer<typeof jobRunTypeSchema>;

export const renderCreativeVideoJobInputSchema = z.object({
  creativeId: z.string().uuid(),
  productId: z.string(),
});
export type RenderCreativeVideoJobInput = z.infer<
  typeof renderCreativeVideoJobInputSchema
>;

export const jobRunStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export type JobRunStatus = z.infer<typeof jobRunStatusSchema>;

export const jobRunTriggerSchema = z.enum(["agent", "api", "cron", "event"]);
export type JobRunTrigger = z.infer<typeof jobRunTriggerSchema>;

export const createCampaignJobInputSchema = z.object({
  productId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  objective: z.string().trim().max(500).optional(),
  channels: z.array(z.string().trim().min(1)).max(20).optional(),
});
export type CreateCampaignJobInput = z.infer<
  typeof createCampaignJobInputSchema
>;

export const generateCreativeStageJobInputSchema = z.object({
  creativeId: z.string().uuid(),
  productId: z.string(),
  stage: creativeStageSchema,
});
export type GenerateCreativeStageJobInput = z.infer<
  typeof generateCreativeStageJobInputSchema
>;

export const generateInsightJobInputSchema = z.object({
  insightId: z.string().uuid(),
  productId: z.string().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  sourceJobId: z.string().uuid().nullable().optional(),
  revisionFeedback: z.string().nullable().optional(),
});
export type GenerateInsightJobInput = z.infer<
  typeof generateInsightJobInputSchema
>;

export const jobRunSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().nullable(),
  type: jobRunTypeSchema,
  status: jobRunStatusSchema,
  trigger: jobRunTriggerSchema,
  triggerRunId: z.string().nullable(),
  createdBy: z.string().nullable(),
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
});
export type JobRun = z.infer<typeof jobRunSchema>;
