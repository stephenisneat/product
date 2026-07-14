import { isDemoMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { DemoArtifactRepository, DemoProductRepository } from "./demo";
import { SupabaseArtifactRepository, SupabaseProductRepository } from "./supabase";
import type { ArtifactRepository, ProductRepository } from "./types";

export async function getProductRepository(): Promise<ProductRepository> {
  if (isDemoMode()) {
    return new DemoProductRepository();
  }
  const client = await createClient();
  return new SupabaseProductRepository(client);
}

export async function getArtifactRepository(): Promise<ArtifactRepository> {
  if (isDemoMode()) {
    return new DemoArtifactRepository();
  }
  const client = await createClient();
  return new SupabaseArtifactRepository(client);
}

export type { ArtifactRepository, ProductRepository } from "./types";
