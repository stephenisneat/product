import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchGatewayChatModels } from "@/lib/ai/models";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const models = await fetchGatewayChatModels();
    return NextResponse.json(
      { models },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (err) {
    console.error("[ai/models] failed to list gateway models", err);
    return NextResponse.json(
      { error: "Failed to load models" },
      { status: 502 },
    );
  }
}
