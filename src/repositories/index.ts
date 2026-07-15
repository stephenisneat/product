import { createClient } from "@/lib/supabase/server";
import { SupabaseArtifactRepository, SupabaseProductRepository } from "./supabase";
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

export type {
  ArtifactRepository,
  ProductRepository,
  WorkspaceRepository,
  WorkspaceWithRole,
} from "./types";
