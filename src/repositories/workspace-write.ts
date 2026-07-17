import { createServiceClient } from "@/lib/supabase/service";
import { SupabaseWorkspaceRepository } from "@/repositories/workspaces";

/** Service-role workspace writes (Stripe webhooks, AI metering). */
export function getWorkspaceWriteRepository(): SupabaseWorkspaceRepository {
  return new SupabaseWorkspaceRepository(createServiceClient());
}
