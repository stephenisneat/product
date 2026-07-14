import { z } from "zod";

export const productStatusSchema = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  handle: z.string().min(1),
  description: z.string(),
  status: productStatusSchema,
  price: z.number().nonnegative(),
  currency: z.string().default("USD"),
  images: z.array(z.string().url()).default([]),
  channels: z.array(z.string()).default([]),
  sku: z.string().optional(),
  category: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ownerId: z.string(),
});

export type Product = z.infer<typeof productSchema>;

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
  isDemo: z.boolean().default(false),
});

export type AppUser = z.infer<typeof appUserSchema>;
