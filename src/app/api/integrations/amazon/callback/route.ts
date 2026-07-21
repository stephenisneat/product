import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  encodeTokenPayload,
  exchangeAmazonCode,
  STATE_COOKIE,
} from "@/lib/commerce/providers/amazon";
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
      `${appUrl}/products/new?amazon=error&reason=no_workspace`,
    );
  }

  const code =
    searchParams.get("spapi_oauth_code") || searchParams.get("code");
  const state = searchParams.get("state");
  const sellingPartnerId = searchParams.get("selling_partner_id");

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/products/new?amazon=error&reason=missing_params`,
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${appUrl}/products/new?amazon=error&reason=missing_state`,
    );
  }

  const [expectedState, marketplaceId, encodedSellerId] = stateCookie.split(".");
  if (expectedState !== state || !marketplaceId) {
    return NextResponse.redirect(
      `${appUrl}/products/new?amazon=error&reason=state_mismatch`,
    );
  }

  const sellerId =
    sellingPartnerId ||
    (encodedSellerId ? decodeURIComponent(encodedSellerId) : "");

  if (!sellerId) {
    return NextResponse.redirect(
      `${appUrl}/products/new?amazon=error&reason=missing_seller`,
    );
  }

  try {
    const token = await exchangeAmazonCode(code);
    const now = new Date().toISOString();
    const products = await getProductRepository();
    await products.upsertConnection({
      id: createConnectionId(),
      workspaceId: active.workspace.id,
      provider: "amazon",
      shopDomain: marketplaceId,
      accessToken: encryptSecret(
        encodeTokenPayload({ ...token, sellerId }),
      ),
      scope: "sellingpartnerapi",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(
      `${appUrl}/products/new?amazon=error&reason=token_exchange`,
    );
  }

  const response = NextResponse.redirect(
    `${appUrl}/products/new?amazon=connected&shop=${encodeURIComponent(marketplaceId)}`,
  );
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
