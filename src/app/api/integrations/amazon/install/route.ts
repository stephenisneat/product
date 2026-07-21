import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/commerce/oauth-cookie";
import {
  buildAuthorizeUrl,
  hasAmazonConfig,
  normalizeMarketplaceId,
  STATE_COOKIE,
} from "@/lib/commerce/providers/amazon";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAmazonConfig()) {
    return NextResponse.json(
      {
        error:
          "Amazon is not configured. Set AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_SP_API_APP_ID, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  let marketplaceId: string;
  let sellerId: string;
  try {
    marketplaceId = normalizeMarketplaceId(
      searchParams.get("marketplace") ?? searchParams.get("shop") ?? "",
    );
    sellerId = (searchParams.get("sellerId") ?? "").trim();
    if (!sellerId) {
      throw new Error("Enter your Amazon Seller ID.");
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid Amazon connection details",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state, marketplaceId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Amazon is not configured",
      },
      { status: 503 },
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    STATE_COOKIE,
    `${state}.${marketplaceId}.${encodeURIComponent(sellerId)}`,
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
