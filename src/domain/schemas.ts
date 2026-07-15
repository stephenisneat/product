import { z } from "zod";

export const productStatusSchema = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const commerceProviderSchema = z.enum(["shopify"]);
export type CommerceProvider = z.infer<typeof commerceProviderSchema>;

export const connectionStatusSchema = z.enum([
  "active",
  "disconnected",
  "error",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceInviteRoleSchema = z.enum(["admin", "member"]);
export type WorkspaceInviteRole = z.infer<typeof workspaceInviteRoleSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
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

export const productSchema = z.object({
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

export type Product = z.infer<typeof productSchema>;

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

export const createProductInputSchema = z.object({
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
  price: z.number().nonnegative("Price must be 0 or greater"),
  currency: z.string().min(1).default("USD"),
  images: z.array(z.string().url()).default([]),
  imageAvgColors: z.array(imageAvgColorSchema).default([]),
  sku: z.string().optional(),
  category: z.string().optional(),
});

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

export const appUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

export type AppUser = z.infer<typeof appUserSchema>;
