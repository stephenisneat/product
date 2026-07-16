"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  ChartNoAxesCombinedIcon,
  LightbulbIcon,
  PaletteIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const catalogPages = [
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

function pageForPath(pathname: string): {
  label: string;
  icon: LucideIcon;
} | null {
  const match = catalogPages.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return match ? { label: match.label, icon: match.icon } : null;
}

export function CatalogNav({ children }: { children?: ReactNode }) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {catalogPages.map(({ href, label, icon: Icon }) => (
        <Button
          key={href}
          render={<Link href={href} />}
          variant="outline"
          size="sm"
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
      ))}
      {children}
    </div>
  );
}

export function CatalogToolbar() {
  const pathname = usePathname();
  const page = pageForPath(pathname);

  if (!page) return null;

  const Icon = page.icon;

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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          <span>{page.label}</span>
        </div>
      </div>
    </div>
  );
}
