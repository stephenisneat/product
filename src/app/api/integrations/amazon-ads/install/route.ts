import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookieSecure } from "@/lib/channels/ad-connection";
import { requireAdChannelAdmin } from "@/lib/channels/ad-channel-auth";
import {
  AMAZON_ADS_STATE_COOKIE,
  buildAmazonAdsAuthorizeUrl,
  hasAmazonAdsConfig,
} from "@/lib/channels/providers/amazon-ads";

/** Start Amazon Ads OAuth — requires workspace admin/owner. */
export async function GET() {
  const auth = await requireAdChannelAdmin("Amazon Ads");
  if ("error" in auth) return auth.error;

  if (!hasAmazonAdsConfig()) {
    return NextResponse.json(
      {
        error:
          "Amazon Ads is not configured. Set AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAmazonAdsAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    AMAZON_ADS_STATE_COOKIE,
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
