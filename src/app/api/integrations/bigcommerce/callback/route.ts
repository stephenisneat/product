import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  exchangeBigCommerceCode,
  normalizeStoreHash,
  STATE_COOKIE,
} from "@/lib/commerce/providers/bigcommerce";
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
      `${appUrl}/products/new?bigcommerce=error&reason=no_workspace`,
    );
  }

  const code = searchParams.get("code");
  const scope = searchParams.get("scope") ?? "";
  const context = searchParams.get("context") ?? "";
  const state = searchParams.get("state");

  if (!code || !context || !state) {
    return NextResponse.redirect(
      `${appUrl}/products/new?bigcommerce=error&reason=missing_params`,
    );
  }

  let storeHash: string;
  try {
    storeHash = normalizeStoreHash(context.replace(/^stores\//, ""));
  } catch {
    return NextResponse.redirect(
      `${appUrl}/products/new?bigcommerce=error&reason=invalid_shop`,
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${appUrl}/products/new?bigcommerce=error&reason=missing_state`,
    );
  }

  const [expectedState, expectedShop] = stateCookie.split(".");
  if (expectedState !== state || expectedShop !== storeHash) {
    return NextResponse.redirect(
      `${appUrl}/products/new?bigcommerce=error&reason=state_mismatch`,
    );
  }

  try {
    const token = await exchangeBigCommerceCode(code, scope, context);
    const now = new Date().toISOString();
    const products = await getProductRepository();
    await products.upsertConnection({
      id: createConnectionId(),
      workspaceId: active.workspace.id,
      provider: "bigcommerce",
      shopDomain: token.storeHash,
      accessToken: encryptSecret(token.accessToken),
      scope: token.scope,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.redirect(
      `${appUrl}/products/new?bigcommerce=error&reason=token_exchange`,
    );
  }

  const response = NextResponse.redirect(
    `${appUrl}/products/new?bigcommerce=connected&shop=${encodeURIComponent(storeHash)}`,
  );
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
