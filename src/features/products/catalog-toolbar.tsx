"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseIcon,
  ChartNoAxesCombinedIcon,
  ChevronRightIcon,
  LightbulbIcon,
  PackageIcon,
  PaletteIcon,
} from "@/components/icons";
import { NavLink } from "@/components/layout/nav-link";
import { getLastVisualizerPath } from "@/features/visualizer/visualization-store";
import type { CatalogAttentionCounts } from "@/lib/catalog/attention-counts";
import { cn } from "@/lib/utils";

const catalogPages = [
  {
    href: "/",
    label: "Products",
    icon: PackageIcon,
    attentionKey: "products",
  },
  {
    href: "/insights",
    label: "Insights",
    icon: LightbulbIcon,
    attentionKey: "insights",
  },
  {
    href: "/creatives",
    label: "Creatives",
    icon: PaletteIcon,
    attentionKey: "creatives",
  },
  {
    href: "/visualizer",
    label: "Visualizer",
    icon: ChartNoAxesCombinedIcon,
    attentionKey: null,
  },
  {
    href: "/jobs",
    label: "Jobs",
    icon: BriefcaseIcon,
    attentionKey: null,
  },
] as const;

/** Stable roots for idle `router.prefetch` from AppShell. */
export const CATALOG_PREFETCH_HREFS = catalogPages.map((page) => page.href);

const CatalogHeaderActionsContext = createContext<HTMLElement | null>(null);

export function isCatalogNavPath(pathname: string) {
  return catalogPages.some(({ href }) => isCatalogNavActive(pathname, href));
}

export function CatalogHeaderActionsProvider({
  actionsNode,
  children,
}: {
  actionsNode: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <CatalogHeaderActionsContext.Provider value={actionsNode}>
      {children}
    </CatalogHeaderActionsContext.Provider>
  );
}

export function CatalogHeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(CatalogHeaderActionsContext);
  if (!slot) return null;
  return createPortal(children, slot);
}

function isCatalogNavActive(pathname: string, href: string) {
  // Exact match for list roots that have their own detail chrome
  // (product workspace lives under /products/[id], creative under /creatives/[id]).
  if (href === "/" || href === "/creatives") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CatalogNav({
  children,
  workspaceId,
}: {
  children?: ReactNode;
  workspaceId?: string | null;
}) {
  const pathname = usePathname();
  // Always start with the SSR-safe default; localStorage is only available
  // after mount, so reading it in useState causes a hydration mismatch.
  const [visualizerHref, setVisualizerHref] = useState("/visualizer");
  const [attention, setAttention] = useState<CatalogAttentionCounts | null>(
    null,
  );

  useEffect(() => {
    if (!workspaceId) {
      setVisualizerHref("/visualizer");
      return;
    }
    function refresh() {
      setVisualizerHref(getLastVisualizerPath(workspaceId!));
    }
    refresh();
    window.addEventListener("visualizations-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("visualizations-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setAttention(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/catalog/attention");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as CatalogAttentionCounts;
        if (cancelled) return;
        setAttention(body);
      } catch {
        // ignore fetch errors
      }
    };

    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => void load(), 20_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [workspaceId, pathname]);

  return (
    <nav className="flex h-12 items-stretch" aria-label="Catalog">
      {catalogPages.map(({ href, label, icon, attentionKey }) => (
        <NavLink
          key={href}
          href={href === "/visualizer" ? visualizerHref : href}
          label={label}
          icon={icon}
          isActive={isCatalogNavActive(pathname, href)}
          badge={
            attentionKey && attention ? attention[attentionKey] : undefined
          }
          prefetch
        />
      ))}
      {children}
    </nav>
  );
}

export type CatalogBreadcrumb = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function CatalogToolbar({
  breadcrumbs,
}: {
  breadcrumbs: CatalogBreadcrumb[];
}) {
  return (
    <nav aria-label="Flow" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const interactive = Boolean(
            (crumb.href || crumb.onClick) && !isLast,
          );

          return (
            <li
              key={`${crumb.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : null}
              {interactive && crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : interactive && crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
