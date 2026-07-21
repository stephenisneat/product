import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookieSecure } from "@/lib/channels/ad-connection";
import { requireAdChannelAdmin } from "@/lib/channels/ad-channel-auth";
import {
  buildTikTokAuthorizeUrl,
  hasTikTokConfig,
  TIKTOK_STATE_COOKIE,
} from "@/lib/channels/providers/tiktok";

/** Start TikTok Ads OAuth — requires workspace admin/owner. */
export async function GET() {
  const auth = await requireAdChannelAdmin("TikTok Ads");
  if ("error" in auth) return auth.error;

  if (!hasTikTokConfig()) {
    return NextResponse.json(
      {
        error:
          "TikTok Ads is not configured. Set TIKTOK_ADS_APP_ID, TIKTOK_ADS_APP_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildTikTokAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    TIKTOK_STATE_COOKIE,
    `${state}.${auth.active.workspace.id}`,
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
