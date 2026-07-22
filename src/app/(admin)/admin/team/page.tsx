import { AdminTeamPanel } from "@/features/admin/admin-team-panel";
import type { PlatformAdminMember } from "@/features/admin/types";
import { getCurrentUser } from "@/lib/auth/session";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export default async function AdminTeamPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let members: PlatformAdminMember[] = [];
  let loadError: string | null = null;

  if (!hasServiceRole()) {
    loadError = "Admin team management is not configured (missing service role).";
  } else {
    const service = createServiceClient();
    const { data, error } = await service
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("is_platform_admin", true)
      .order("full_name", { ascending: true, nullsFirst: false });

    if (error) {
      loadError = error.message;
    } else {
      members = ((data ?? []) as ProfileRow[]).map((row) => ({
        id: row.id,
        email: row.email,
        name: row.full_name,
        avatarUrl: row.avatar_url,
      }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People with access to the Admin Center.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <AdminTeamPanel members={members} currentUserId={user.id} />
      )}
    </div>
  );
}
