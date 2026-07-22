import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import {
  SupabaseAdConnectionRepository,
  type AdConnectionRepository,
} from "./ad-connections";
import { SupabaseCreativeRepository } from "./creatives";
import { SupabaseGoalRepository } from "./goals";
import { SupabaseInsightRepository } from "./insights";
import { SupabaseJobRepository } from "./jobs";
import { SupabaseProductRepository } from "./supabase";
import { SupabaseWalletRepository } from "./wallet";
import { SupabaseWorkspaceRepository } from "./workspaces";
import type {
  CreativeRepository,
  JobRepository,
  ProductRepository,
  WorkspaceRepository,
} from "./types";

export async function getAdConnectionRepository(): Promise<AdConnectionRepository> {
  const client = await createClient();
  return new SupabaseAdConnectionRepository(client);
}

/** Service-role ad connection writes for token refresh from background jobs. */
export function getAdConnectionWriteRepository(): AdConnectionRepository {
  return new SupabaseAdConnectionRepository(createServiceClient());
}

export async function getProductRepository(): Promise<ProductRepository> {
  const client = await createClient();
  return new SupabaseProductRepository(client);
}

/** Service-role product writes for background jobs. */
export function getProductWriteRepository(): ProductRepository {
  return new SupabaseProductRepository(createServiceClient());
}


export async function getCreativeRepository(): Promise<CreativeRepository> {
  const client = await createClient();
  return new SupabaseCreativeRepository(client);
}

/** Service-role creative writes for background jobs. */
export function getCreativeWriteRepository(): CreativeRepository {
  return new SupabaseCreativeRepository(createServiceClient());
}

export async function getGoalRepository(): Promise<SupabaseGoalRepository> {
  const client = await createClient();
  return new SupabaseGoalRepository(client);
}

/** Service-role goal reads/writes for background jobs. */
export function getGoalWriteRepository(): SupabaseGoalRepository {
  return new SupabaseGoalRepository(createServiceClient());
}

export async function getInsightRepository(): Promise<SupabaseInsightRepository> {
  const client = await createClient();
  return new SupabaseInsightRepository(client);
}

/** Service-role insight writes for background jobs. */
export function getInsightWriteRepository(): SupabaseInsightRepository {
  return new SupabaseInsightRepository(createServiceClient());
}

export async function getWorkspaceRepository(): Promise<WorkspaceRepository> {
  const client = await createClient();
  return new SupabaseWorkspaceRepository(client);
}

/**
 * Job reads after workspace membership is already established.
 * Prefer service role: job_runs has no authenticated write policies, and
 * member SELECT via RLS has returned empty in production for workspaces
 * that can still read sibling tables (creatives/products).
 */
export function getJobReadRepository(): JobRepository {
  return new SupabaseJobRepository(createServiceClient());
}

/** Membership-gated job reads (page/API). Uses service role when configured. */
export async function getJobRepository(): Promise<JobRepository> {
  if (hasServiceRole()) {
    return getJobReadRepository();
  }
  const client = await createClient();
  return new SupabaseJobRepository(client);
}

/** Write path (enqueue / status updates) uses the service role. */
export function getJobWriteRepository(): JobRepository {
  return new SupabaseJobRepository(createServiceClient());
}

/** Read path uses the user session (RLS). */
export async function getWalletRepository(): Promise<SupabaseWalletRepository> {
  const client = await createClient();
  return new SupabaseWalletRepository(client);
}

/** Write path (credits/debits/ensure) uses the service role. */
export function getWalletWriteRepository(): SupabaseWalletRepository {
  return new SupabaseWalletRepository(createServiceClient());
}

export type {
  CreativeRepository,
  JobRepository,
  ProductRepository,
  WorkspaceRepository,
  WorkspaceWithRole,
} from "./types";
export type {
  AdConnectionRecord,
  AdConnectionRepository,
} from "./ad-connections";
export type { SupabaseWalletRepository } from "./wallet";
export type { SupabaseJobRepository } from "./jobs";
export type { SupabaseGoalRepository } from "./goals";
export type { SupabaseInsightRepository } from "./insights";
export {
  effectiveIncludedAllotmentCents,
  getWalletBlockedReason,
  nextMonthResetIso,
  remainingIncludedUsageCents,
} from "./wallet";
export { getWorkspaceWriteRepository } from "./workspace-write";
