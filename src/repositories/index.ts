import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SupabaseArtifactRepository, SupabaseProductRepository } from "./supabase";
import { SupabaseWalletRepository } from "./wallet";
import { SupabaseWorkspaceRepository } from "./workspaces";
import type {
  ArtifactRepository,
  ProductRepository,
  WorkspaceRepository,
} from "./types";

export async function getProductRepository(): Promise<ProductRepository> {
  const client = await createClient();
  return new SupabaseProductRepository(client);
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
  ProductRepository,
  WorkspaceRepository,
  WorkspaceWithRole,
} from "./types";
export type { SupabaseWalletRepository } from "./wallet";
export {
  getWalletBlockedReason,
  nextMonthResetIso,
  remainingIncludedUsageCents,
} from "./wallet";
export { getWorkspaceWriteRepository } from "./workspace-write";
