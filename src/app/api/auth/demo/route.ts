import { NextResponse } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  createDemoSessionToken,
  demoSessionCookieOptions,
} from "@/lib/auth/demo-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.set(
    DEMO_SESSION_COOKIE,
    createDemoSessionToken(),
    demoSessionCookieOptions({ secure: url.protocol === "https:" }),
  );
  return response;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin), 303);
  response.cookies.set(
    DEMO_SESSION_COOKIE,
    createDemoSessionToken(),
    demoSessionCookieOptions({ secure: url.protocol === "https:" }),
  );
  return response;
}
