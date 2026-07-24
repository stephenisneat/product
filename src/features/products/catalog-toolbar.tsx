"use client";

import {
  createContext,
  type ReactNode,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Roots that show the in-canvas header actions slot. */
export const CATALOG_PREFETCH_HREFS = [
  "/",
  "/insights",
  "/studio",
  "/visualizer",
  "/logs",
] as const;

const CatalogHeaderActionsContext = createContext<HTMLElement | null>(null);

function isCatalogNavActive(pathname: string, href: string) {
  if (href === "/" || href === "/studio") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isCatalogNavPath(pathname: string) {
  return CATALOG_PREFETCH_HREFS.some((href) =>
    isCatalogNavActive(pathname, href),
  );
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
