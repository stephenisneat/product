import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  exchangeShopifyCode,
  getShopifyConfig,
  normalizeShopDomain,
  STATE_COOKIE,
  verifyShopifyHmac,
} from "@/lib/commerce/providers/shopify";
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
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=no_workspace`);
  }

  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const code = query.code;
  const shopRaw = query.shop;
  const state = query.state;

  if (!code || !shopRaw || !state) {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=missing_params`);
  }

  let shop: string;
  try {
    shop = normalizeShopDomain(shopRaw);
  } catch {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=invalid_shop`);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=missing_state`);
  }

  const [expectedState, expectedShop] = stateCookie.split(".");
  if (expectedState !== state || expectedShop !== shop) {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=state_mismatch`);
  }

  let apiSecret: string;
  try {
    apiSecret = getShopifyConfig().apiSecret;
  } catch {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=not_configured`);
  }

  if (!verifyShopifyHmac(query, apiSecret)) {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=hmac`);
  }

  try {
    const token = await exchangeShopifyCode(shop, code);
    const now = new Date().toISOString();
    const products = await getProductRepository();
    await products.upsertConnection({
      id: createConnectionId(),
      workspaceId: active.workspace.id,
      provider: "shopify",
      shopDomain: shop,
      accessToken: encryptSecret(token.accessToken),
      scope: token.scope,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(`${appUrl}/products/new?shopify=error&reason=token_exchange`);
  }

  const response = NextResponse.redirect(
    `${appUrl}/products/new?shopify=connected&shop=${encodeURIComponent(shop)}`,
  );
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
