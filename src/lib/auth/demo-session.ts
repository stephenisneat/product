import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AppUser } from "@/domain";
import { DEMO_USER } from "@/lib/demo/seed";

export const DEMO_SESSION_COOKIE = "pa_demo_session";

function getSecret(): string {
  return process.env.DEMO_SESSION_SECRET ?? "product-agent-demo-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createDemoSessionToken(userId: string = DEMO_USER.id): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyDemoSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, ts, signature] = parts;
  if (!userId || !ts || !signature) return false;
  const payload = `${userId}.${ts}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function getDemoUserFromCookies(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!verifyDemoSessionToken(token)) return null;
  return { ...DEMO_USER };
}

export function demoSessionCookieOptions(options?: {
  maxAgeSeconds?: number;
  secure?: boolean;
}) {
  const maxAgeSeconds = options?.maxAgeSeconds ?? 60 * 60 * 24 * 30;
  const secure =
    options?.secure ??
    (process.env.COOKIE_SECURE === "true" || process.env.VERCEL === "1");

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Prefer explicit HTTPS / Vercel — local `next start` and Playwright use HTTP.
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
