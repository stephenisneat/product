import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookieSecure } from "@/lib/channels/ad-connection";
import { requireAdChannelAdmin } from "@/lib/channels/ad-channel-auth";
import {
  buildMetaAuthorizeUrl,
  hasMetaConfig,
  META_STATE_COOKIE,
} from "@/lib/channels/providers/meta";

/** Start Meta Ads OAuth — requires workspace admin/owner. */
export async function GET() {
  const auth = await requireAdChannelAdmin("Meta Ads");
  if ("error" in auth) return auth.error;

  if (!hasMetaConfig()) {
    return NextResponse.json(
      {
        error:
          "Meta Ads is not configured. Set META_APP_ID, META_APP_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildMetaAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(META_STATE_COOKIE, `${state}.${auth.active.workspace.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
