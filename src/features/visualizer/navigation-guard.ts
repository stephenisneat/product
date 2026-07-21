/**
 * Lightweight navigation guard used while visualization drafts are dirty.
 * Covers Link clicks, history mutations (router.push), and back/forward.
 */

type Guard = (nextUrl: string) => boolean;

let guard: Guard | null = null;

export function setNavigationGuard(next: Guard | null) {
  guard = next;
}

/** Returns true if navigation should proceed. */
export function runNavigationGuard(nextUrl: string): boolean {
  if (!guard) return true;
  return guard(nextUrl);
}

function toAbsoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function sameDocumentPath(url: string): boolean {
  try {
    const next = new URL(url, window.location.href);
    return (
      next.origin === window.location.origin &&
      next.pathname === window.location.pathname &&
      next.search === window.location.search
    );
  } catch {
    return false;
  }
}

export function installNavigationGuards(): () => void {
  let currentUrl = window.location.href;
  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  const onDocumentClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;

    const href = anchor.href;
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    try {
      const url = new URL(href);
      if (url.origin !== window.location.origin) {
        if (!runNavigationGuard(href)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
    } catch {
      return;
    }

    if (sameDocumentPath(href)) return;
    if (!runNavigationGuard(href)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener("click", onDocumentClick, true);

  window.history.pushState = function pushState(data, unused, url) {
    if (url != null) {
      const href = toAbsoluteUrl(String(url));
      if (!sameDocumentPath(href) && !runNavigationGuard(href)) {
        return;
      }
    }
    const result = originalPushState(data, unused, url);
    currentUrl = window.location.href;
    return result;
  };

  window.history.replaceState = function replaceState(data, unused, url) {
    if (url != null) {
      const href = toAbsoluteUrl(String(url));
      if (!sameDocumentPath(href) && !runNavigationGuard(href)) {
        return;
      }
    }
    const result = originalReplaceState(data, unused, url);
    currentUrl = window.location.href;
    return result;
  };

  const onPopState = () => {
    const nextUrl = window.location.href;
    if (nextUrl === currentUrl) return;
    if (!runNavigationGuard(nextUrl)) {
      // Revert back/forward navigation.
      originalPushState(window.history.state, "", currentUrl);
      return;
    }
    currentUrl = nextUrl;
  };

  window.addEventListener("popstate", onPopState);

  type NavigationEventLike = Event & {
    hashChange?: boolean;
    downloadRequest?: string | null;
    destination?: { url: string };
    preventDefault: () => void;
  };

  const navigation = (
    window as Window & {
      navigation?: {
        addEventListener: (
          type: "navigate",
          listener: (event: NavigationEventLike) => void,
        ) => void;
        removeEventListener: (
          type: "navigate",
          listener: (event: NavigationEventLike) => void,
        ) => void;
      };
    }
  ).navigation;

  const onNavigate = (event: NavigationEventLike) => {
    if (event.hashChange || event.downloadRequest) return;
    const dest = event.destination?.url;
    if (!dest || sameDocumentPath(dest)) return;
    if (!runNavigationGuard(dest)) {
      event.preventDefault();
    }
  };

  navigation?.addEventListener("navigate", onNavigate);

  return () => {
    document.removeEventListener("click", onDocumentClick, true);
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
    navigation?.removeEventListener("navigate", onNavigate);
  };
}
