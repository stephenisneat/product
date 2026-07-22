import { NextResponse } from "next/server";
import type { AdminUserSearchResult } from "@/features/admin/types";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
};

function mapRow(row: ProfileRow): AdminUserSearchResult {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name,
    avatarUrl: row.avatar_url,
    isPlatformAdmin: Boolean(row.is_platform_admin),
  };
}

export async function GET(req: Request) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Admin user search is not configured" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ users: [] as AdminUserSearchResult[] });
  }

  const pattern = `%${q}%`;
  const service = createServiceClient();
  const select = "id, email, full_name, avatar_url, is_platform_admin";

  const [byEmail, byName] = await Promise.all([
    service.from("profiles").select(select).ilike("email", pattern).limit(20),
    service
      .from("profiles")
      .select(select)
      .ilike("full_name", pattern)
      .limit(20),
  ]);

  if (byEmail.error) {
    return NextResponse.json({ error: byEmail.error.message }, { status: 500 });
  }
  if (byName.error) {
    return NextResponse.json({ error: byName.error.message }, { status: 500 });
  }

  const byId = new Map<string, AdminUserSearchResult>();
  for (const row of [
    ...((byEmail.data ?? []) as ProfileRow[]),
    ...((byName.data ?? []) as ProfileRow[]),
  ]) {
    if (!byId.has(row.id)) byId.set(row.id, mapRow(row));
  }

  const users = [...byId.values()]
    .sort((a, b) =>
      (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id),
    )
    .slice(0, 20);

  return NextResponse.json({ users });
}
