import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/channels/ad-connection";
import { requireAdChannelAdmin } from "@/lib/channels/ad-channel-auth";
import {
  buildXAdsAuthorizeUrl,
  createPkcePair,
  hasXAdsConfig,
  X_ADS_STATE_COOKIE,
} from "@/lib/channels/providers/x-ads";
import { randomBytes } from "node:crypto";

/** Start X Ads OAuth (PKCE) — requires workspace admin/owner. */
export async function GET() {
  const auth = await requireAdChannelAdmin("X Ads");
  if ("error" in auth) return auth.error;

  if (!hasXAdsConfig()) {
    return NextResponse.json(
      {
        error:
          "X Ads is not configured. Set X_ADS_CLIENT_ID, X_ADS_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkcePair();
  const authorizeUrl = buildXAdsAuthorizeUrl(state, challenge);
  const response = NextResponse.redirect(authorizeUrl);
  // state.workspaceId.codeVerifier
  response.cookies.set(
    X_ADS_STATE_COOKIE,
    `${state}.${auth.active.workspace.id}.${verifier}`,
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
