const FAVICON_HOST = "https://www.google.com/s2/favicons";

export function faviconUrlForDomain(domain: string, size = 128): string {
  const params = new URLSearchParams({
    domain: domain.toLowerCase(),
    sz: String(size),
  });
  return `${FAVICON_HOST}?${params.toString()}`;
}

export function isFaviconAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "www.google.com" &&
      parsed.pathname === "/s2/favicons"
    );
  } catch {
    return false;
  }
}

/** Prefer keeping a custom upload; otherwise use/refresh the domain favicon. */
export function resolveAvatarUrl(input: {
  currentAvatarUrl?: string | null;
  nextAvatarUrl?: string | null;
  joinDomain?: string | null;
  clearAvatar?: boolean;
}): string | null {
  if (input.clearAvatar) {
    return input.joinDomain ? faviconUrlForDomain(input.joinDomain) : null;
  }

  if (input.nextAvatarUrl !== undefined) {
    return input.nextAvatarUrl;
  }

  const current = input.currentAvatarUrl ?? null;
  if (current && !isFaviconAvatarUrl(current)) {
    return current;
  }

  if (input.joinDomain) {
    return faviconUrlForDomain(input.joinDomain);
  }

  return current && isFaviconAvatarUrl(current) ? null : current;
}
