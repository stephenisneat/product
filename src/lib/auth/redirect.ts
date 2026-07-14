/**
 * Ensure post-auth redirects stay on same-origin relative paths.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

export function authCallbackUrl(origin: string, next = "/"): string {
  const params = new URLSearchParams({ next: safeNextPath(next) });
  return `${origin}/auth/callback?${params.toString()}`;
}
