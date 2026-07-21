import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/commerce/oauth-cookie";
import {
  buildAuthorizeUrl,
  hasShopifyConfig,
  normalizeShopDomain,
  STATE_COOKIE,
} from "@/lib/commerce/providers/shopify";
import { randomBytes } from "node:crypto";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasShopifyConfig()) {
    return NextResponse.json(
      {
        error:
          "Shopify is not configured. Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  let shop: string;
  try {
    shop = normalizeShopDomain(searchParams.get("shop") ?? "");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid shop domain",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(shop, state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, `${state}.${shop}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
