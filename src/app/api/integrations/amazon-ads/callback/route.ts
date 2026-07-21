import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  AMAZON_ADS_STATE_COOKIE,
  exchangeAmazonAdsCode,
  getAmazonAdsConfig,
} from "@/lib/channels/providers/amazon-ads";
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
      `${settingsUrl}?amazon_ads=error&reason=no_workspace`,
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=missing_params`,
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(AMAZON_ADS_STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=missing_state`,
    );
  }

  const [expectedState, expectedWorkspaceId] = stateCookie.split(".");
  if (expectedState !== state || expectedWorkspaceId !== active.workspace.id) {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=state_mismatch`,
    );
  }

  try {
    getAmazonAdsConfig();
  } catch {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=not_configured`,
    );
  }

  try {
    const token = await exchangeAmazonAdsCode(code);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
    const repo = await getAdConnectionRepository();

    await repo.upsertConnection({
      id: createAdConnectionId(),
      workspaceId: active.workspace.id,
      provider: "amazon",
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
      metadata: { channels: ["SP", "SB", "SD"] },
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(
      `${settingsUrl}?amazon_ads=error&reason=token_exchange`,
    );
  }

  const response = NextResponse.redirect(
    `${settingsUrl}?amazon_ads=select_account`,
  );
  response.cookies.set(AMAZON_ADS_STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
