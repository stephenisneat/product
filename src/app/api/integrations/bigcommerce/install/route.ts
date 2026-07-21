import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/commerce/oauth-cookie";
import {
  buildAuthorizeUrl,
  hasBigCommerceConfig,
  normalizeStoreHash,
  STATE_COOKIE,
} from "@/lib/commerce/providers/bigcommerce";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasBigCommerceConfig()) {
    return NextResponse.json(
      {
        error:
          "BigCommerce is not configured. Set BIGCOMMERCE_CLIENT_ID, BIGCOMMERCE_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  let storeHash: string;
  try {
    storeHash = normalizeStoreHash(searchParams.get("shop") ?? "");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid store hash",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(storeHash, state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, `${state}.${storeHash}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
