import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlatformAdminMember } from "@/features/admin/types";
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
};

function mapProfile(row: ProfileRow): PlatformAdminMember {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name,
    avatarUrl: row.avatar_url,
  };
}

const grantSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Admin team management is not configured" },
      { status: 503 },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("is_platform_admin", true)
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = ((data ?? []) as ProfileRow[]).map(mapProfile);
  return NextResponse.json({ members });
}

export async function POST(req: Request) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Admin team management is not configured" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = grantSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .update({ is_platform_admin: true })
    .eq("id", parsed.data.userId)
    .select("id, email, full_name, avatar_url")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    { member: mapProfile(data as ProfileRow) },
    { status: 201 },
  );
}
