"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseIcon,
  ChartNoAxesCombinedIcon,
  LightbulbIcon,
  PaletteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const toolbarLinks = [
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

export function CatalogToolbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {toolbarLinks.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Button
            key={href}
            render={<Link href={href} />}
            variant="outline"
            size="sm"
            aria-current={active ? "page" : undefined}
            className={cn(active && "bg-muted text-foreground")}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        );
      })}
      {children}
    </div>
  );
}
