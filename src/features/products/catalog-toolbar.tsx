"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  ChartNoAxesCombinedIcon,
  LightbulbIcon,
  PackageIcon,
  PaletteIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { getLastVisualizerPath } from "@/features/visualizer/visualization-store";

const catalogPages = [
  {
    href: "/",
    label: "Products",
    icon: PackageIcon,
  },
  {
    href: "/insights",
    label: "Insights",
    icon: LightbulbIcon,
  },
  {
    href: "/creatives",
    label: "Creatives",
    icon: PaletteIcon,
  },
  {
    href: "/visualizer",
    label: "Visualizer",
    icon: ChartNoAxesCombinedIcon,
  },
  {
    href: "/jobs",
    label: "Jobs",
    icon: BriefcaseIcon,
  },
] as const;

const toolbarOnlyPages = [
  {
    href: "/products/new",
    label: "Add products",
    icon: PlusIcon,
  },
] as const;

function pageForPath(pathname: string): {
  label: string;
  icon: LucideIcon;
} | null {
  const match = [...catalogPages, ...toolbarOnlyPages].find(({ href }) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  });
  return match ? { label: match.label, icon: match.icon } : null;
}

function isCatalogNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readVisualizerHref(workspaceId: string | null | undefined): string {
  if (!workspaceId || typeof window === "undefined") return "/visualizer";
  return getLastVisualizerPath(workspaceId);
}

export function CatalogNav({
  children,
  workspaceId,
}: {
  children?: ReactNode;
  workspaceId?: string | null;
}) {
  const pathname = usePathname();
  const [visualizerHref, setVisualizerHref] = useState(() =>
    readVisualizerHref(workspaceId),
  );

  useEffect(() => {
    if (!workspaceId) {
      return;
    }
    function refresh() {
      setVisualizerHref(getLastVisualizerPath(workspaceId!));
    }
    window.addEventListener("visualizations-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("visualizations-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceId]);

  return (
    <nav className="flex h-12 items-stretch" aria-label="Catalog">
      {catalogPages.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={href === "/visualizer" ? visualizerHref : href}
          label={label}
          icon={icon}
          isActive={isCatalogNavActive(pathname, href)}
        />
      ))}
      {children}
    </nav>
  );
}

export function CatalogToolbar({ title }: { title?: string } = {}) {
  const pathname = usePathname();
  const page = pageForPath(pathname);

  if (!page && !title) return null;

  const Icon = page?.icon;
  const label = title ?? page?.label;

  return (
    <div className="relative flex w-full items-center">
      <Button
        render={<Link href="/" />}
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back
      </Button>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-20">
        <div className="flex max-w-full items-center gap-2 text-sm font-medium">
          {Icon && !title ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="truncate">{label}</span>
        </div>
      </div>
    </div>
  );
}
