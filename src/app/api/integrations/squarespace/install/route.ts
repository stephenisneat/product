import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/commerce/oauth-cookie";
import {
  buildAuthorizeUrl,
  hasSquarespaceConfig,
  normalizeSiteId,
  STATE_COOKIE,
} from "@/lib/commerce/providers/squarespace";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSquarespaceConfig()) {
    return NextResponse.json(
      {
        error:
          "Squarespace is not configured. Set SQUARESPACE_CLIENT_ID, SQUARESPACE_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  let siteId: string;
  try {
    siteId = normalizeSiteId(searchParams.get("shop") ?? "squarespace");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid site identifier",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, `${state}.${siteId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
