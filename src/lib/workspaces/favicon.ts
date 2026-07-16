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

function faviconDomainFor(input: {
  primaryDomain?: string | null;
  joinDomain?: string | null;
}): string | null {
  return input.primaryDomain || input.joinDomain || null;
}

/** Prefer keeping a custom upload; otherwise use/refresh the domain favicon. */
export function resolveAvatarUrl(input: {
  currentAvatarUrl?: string | null;
  nextAvatarUrl?: string | null;
  primaryDomain?: string | null;
  joinDomain?: string | null;
  clearAvatar?: boolean;
}): string | null {
  const faviconDomain = faviconDomainFor(input);

  if (input.clearAvatar) {
    return faviconDomain ? faviconUrlForDomain(faviconDomain) : null;
  }

  if (input.nextAvatarUrl !== undefined) {
    return input.nextAvatarUrl;
  }

  const current = input.currentAvatarUrl ?? null;
  if (current && !isFaviconAvatarUrl(current)) {
    return current;
  }

  if (faviconDomain) {
    return faviconUrlForDomain(faviconDomain);
  }

  return current && isFaviconAvatarUrl(current) ? null : current;
}
