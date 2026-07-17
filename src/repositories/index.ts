import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SupabaseJobRepository } from "./jobs";
import { SupabaseArtifactRepository, SupabaseProductRepository } from "./supabase";
import { SupabaseWalletRepository } from "./wallet";
import { SupabaseWorkspaceRepository } from "./workspaces";
import type {
  ArtifactRepository,
  JobRepository,
  ProductRepository,
  WorkspaceRepository,
} from "./types";

export async function getProductRepository(): Promise<ProductRepository> {
  const client = await createClient();
  return new SupabaseProductRepository(client);
}

/** Service-role product writes for background jobs. */
export function getProductWriteRepository(): ProductRepository {
  return new SupabaseProductRepository(createServiceClient());
}

export async function getArtifactRepository(): Promise<ArtifactRepository> {
  const client = await createClient();
  return new SupabaseArtifactRepository(client);
}

export async function getWorkspaceRepository(): Promise<WorkspaceRepository> {
  const client = await createClient();
  return new SupabaseWorkspaceRepository(client);
}

/** Read path uses the user session (RLS). */
export async function getJobRepository(): Promise<JobRepository> {
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
  ArtifactRepository,
  JobRepository,
  ProductRepository,
  WorkspaceRepository,
  WorkspaceWithRole,
} from "./types";
export type { SupabaseWalletRepository } from "./wallet";
export type { SupabaseJobRepository } from "./jobs";
export {
  effectiveIncludedAllotmentCents,
  getWalletBlockedReason,
  nextMonthResetIso,
  remainingIncludedUsageCents,
} from "./wallet";
export { getWorkspaceWriteRepository } from "./workspace-write";
