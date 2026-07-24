"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartNoAxesCombinedIcon,
  InboxIcon,
  PaletteIcon,
  ScrollTextIcon,
  type IconComponent,
} from "@/components/icons";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppUser } from "@/domain";
import { runNavigationGuard } from "@/features/visualizer/navigation-guard";
import { getLastVisualizerPath } from "@/features/visualizer/visualization-store";
import type { CatalogAttentionCounts } from "@/lib/catalog/attention-counts";
import { cn } from "@/lib/utils";

const appNavItems = [
  {
    href: "/",
    label: "Inbox",
    icon: InboxIcon,
    attentionKey: "products" as const,
  },
  {
    href: "/studio",
    label: "Studio",
    icon: PaletteIcon,
    attentionKey: "creatives" as const,
  },
  {
    href: "/visualizer",
    label: "Visualizer",
    icon: ChartNoAxesCombinedIcon,
    attentionKey: null,
  },
  {
    href: "/logs",
    label: "Logs",
    icon: ScrollTextIcon,
    attentionKey: null,
  },
] as const;

/** Stable roots for idle `router.prefetch` from AppShell. */
export const APP_NAV_PREFETCH_HREFS = [
  "/",
  "/studio",
  "/visualizer",
  "/logs",
  "/insights",
] as const;

function isAppNavActive(pathname: string, href: string) {
  // Exact match for list roots that have their own detail chrome
  // (product workspace lives under /products/[id], creative under /studio/[id]).
  if (href === "/" || href === "/studio") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isPlainLeftClick(
  e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
) {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

function SidebarLogo() {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={50}
        render={
          <Link
            href="/"
            aria-label="Product Agent"
            className="flex size-9 items-center justify-center rounded-lg bg-neutral-800 transition-colors hover:bg-neutral-700"
          />
        }
      >
        <span
          aria-hidden
          className="size-3.5 rotate-45 rounded-[3px] bg-foreground"
        />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        Product Agent
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
}: {
  href: string;
  label: string;
  icon: IconComponent;
  isActive: boolean;
  badge?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Tooltip>
      <TooltipTrigger
        delay={50}
        render={
          <Link
            href={href}
            prefetch
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            onMouseDown={(e) => {
              if (!isPlainLeftClick(e)) return;
              if (pathname === href) return;
              router.push(href);
            }}
            onClick={(e) => {
              if (e.detail === 0) return;
              if (!isPlainLeftClick(e)) return;
              e.preventDefault();
            }}
            onNavigate={(event) => {
              if (!runNavigationGuard(href)) {
                event.preventDefault();
              }
            }}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-secondary text-foreground"
                : "text-neutral-400 hover:bg-muted hover:text-foreground",
            )}
          />
        }
      >
        <Icon className="size-4" />
        {badge != null && badge > 0 ? (
          <span
            className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground"
            aria-label={`${badge} need attention`}
          />
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar({
  user,
  workspaceId,
  isPlatformAdmin = false,
}: {
  user: AppUser;
  workspaceId?: string | null;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
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
    <aside className="flex h-full w-12 shrink-0 flex-col items-center bg-black pb-2">
      <div className="flex h-12 shrink-0 items-center justify-center">
        <SidebarLogo />
      </div>
      <nav className="flex flex-col items-center gap-1" aria-label="Primary">
        {appNavItems.map(({ href, label, icon, attentionKey }) => (
          <SidebarNavLink
            key={href}
            href={href === "/visualizer" ? visualizerHref : href}
            label={label}
            icon={icon}
            isActive={isAppNavActive(pathname, href)}
            badge={
              attentionKey && attention ? attention[attentionKey] : undefined
            }
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center">
        <UserMenu user={user} isPlatformAdmin={isPlatformAdmin} />
      </div>
    </aside>
  );
}
