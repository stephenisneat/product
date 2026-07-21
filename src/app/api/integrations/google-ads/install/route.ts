import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import {
  buildGoogleAdsAuthorizeUrl,
  GOOGLE_ADS_STATE_COOKIE,
  hasGoogleAdsConfig,
} from "@/lib/channels/providers/google-ads";
import { randomBytes } from "node:crypto";

function cookieSecure() {
  return (
    process.env.COOKIE_SECURE === "true" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}

/** Start Google Ads OAuth — requires workspace admin/owner. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  if (!canManageMembers(active.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can connect Google Ads." },
      { status: 403 },
    );
  }

  if (!hasGoogleAdsConfig()) {
    return NextResponse.json(
      {
        error:
          "Google Ads is not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildGoogleAdsAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    GOOGLE_ADS_STATE_COOKIE,
    `${state}.${active.workspace.id}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 60 * 10,
    },
  );
  return response;
}
