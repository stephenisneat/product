import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  exchangeXAdsCode,
  getXAdsConfig,
  X_ADS_STATE_COOKIE,
} from "@/lib/channels/providers/x-ads";
import { createAdConnectionId } from "@/lib/products/slugify";
import { getAdConnectionRepository } from "@/repositories";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const { searchParams, origin } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;
  const settingsUrl = `${appUrl}/settings/connections`;

  if (!user) {
    return NextResponse.redirect(
      `${appUrl}/login?error=auth&next=/settings/connections`,
    );
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=no_workspace`,
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=missing_params`,
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(X_ADS_STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=missing_state`,
    );
  }

  const [expectedState, expectedWorkspaceId, codeVerifier] =
    stateCookie.split(".");
  if (
    !codeVerifier ||
    expectedState !== state ||
    expectedWorkspaceId !== active.workspace.id
  ) {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=state_mismatch`,
    );
  }

  try {
    getXAdsConfig();
  } catch {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=not_configured`,
    );
  }

  try {
    const token = await exchangeXAdsCode(code, codeVerifier);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
    const repo = await getAdConnectionRepository();

    await repo.upsertConnection({
      id: createAdConnectionId(),
      workspaceId: active.workspace.id,
      provider: "x",
      externalAccountId: null,
      loginCustomerId: null,
      accountName: "",
      currencyCode: null,
      timeZone: null,
      isManager: false,
      refreshToken: encryptSecret(token.refreshToken),
      accessToken: encryptSecret(token.accessToken),
      tokenExpiresAt: expiresAt,
      scope: token.scope,
      status: "pending",
      connectedBy: user.id,
      metadata: { channels: ["PROMOTED_TWEETS"] },
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(
      `${settingsUrl}?x_ads=error&reason=token_exchange`,
    );
  }

  const response = NextResponse.redirect(
    `${settingsUrl}?x_ads=select_account`,
  );
  response.cookies.set(X_ADS_STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
