import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  encodeTokenPayload,
  exchangeSquarespaceCode,
  STATE_COOKIE,
} from "@/lib/commerce/providers/squarespace";
import { createConnectionId } from "@/lib/products/slugify";
import { getProductRepository } from "@/repositories";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const { searchParams, origin } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?error=auth`);
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.redirect(
      `${appUrl}/products/new?squarespace=error&reason=no_workspace`,
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/products/new?squarespace=error&reason=missing_params`,
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${appUrl}/products/new?squarespace=error&reason=missing_state`,
    );
  }

  const [expectedState, siteId] = stateCookie.split(".");
  if (expectedState !== state || !siteId) {
    return NextResponse.redirect(
      `${appUrl}/products/new?squarespace=error&reason=state_mismatch`,
    );
  }

  try {
    const token = await exchangeSquarespaceCode(code);
    const now = new Date().toISOString();
    const products = await getProductRepository();
    await products.upsertConnection({
      id: createConnectionId(),
      workspaceId: active.workspace.id,
      provider: "squarespace",
      shopDomain: siteId,
      accessToken: encryptSecret(encodeTokenPayload(token)),
      scope: "website.products.read website.inventory.read",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(
      `${appUrl}/products/new?squarespace=error&reason=token_exchange`,
    );
  }

  const response = NextResponse.redirect(
    `${appUrl}/products/new?squarespace=connected&shop=${encodeURIComponent(siteId)}`,
  );
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
