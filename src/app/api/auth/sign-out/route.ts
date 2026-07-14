import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore when cookies cannot be written from this path.
  }

  return response;
}
