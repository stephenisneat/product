import { NextResponse } from "next/server";
import { createAdminFeedbackSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Submit feedback / channel requests (any signed-in user). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createAdminFeedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { kind, title, body, screenshotUrl } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("admin_feedback").insert({
    user_id: user.id,
    user_email: user.email,
    kind,
    title,
    body: body?.trim() ? body.trim() : null,
    screenshot_url: screenshotUrl ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to submit feedback" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
