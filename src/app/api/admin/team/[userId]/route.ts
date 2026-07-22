import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  createServiceClient,
  hasServiceRole,
} from "@/lib/supabase/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
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

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const service = createServiceClient();

  const { count, error: countError } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_platform_admin", true);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last platform admin" },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .from("profiles")
    .update({ is_platform_admin: false })
    .eq("id", userId)
    .eq("is_platform_admin", true)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "User is not a platform admin" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
