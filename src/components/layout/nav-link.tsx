"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { IconComponent } from "@/components/icons";
import { runNavigationGuard } from "@/features/visualizer/navigation-guard";
import { cn } from "@/lib/utils";

function isPlainLeftClick(e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">) {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

export function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
  prefetch = true,
}: {
  href: string;
  label: string;
  icon: IconComponent;
  isActive: boolean;
  /** Attention count; only rendered when > 0. */
  badge?: number;
  prefetch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={isActive ? "page" : undefined}
      onMouseDown={(e) => {
        if (!isPlainLeftClick(e)) return;
        if (pathname === href) return;
        router.push(href);
      }}
      onClick={(e) => {
        // Keyboard activation uses detail 0 — let Link handle it.
        if (e.detail === 0) return;
        if (!isPlainLeftClick(e)) return;
        // Already navigated on mousedown; block the mouseup click.
        e.preventDefault();
      }}
      onNavigate={(event) => {
        if (!runNavigationGuard(href)) {
          event.preventDefault();
        }
      }}
      className={cn(
        "relative inline-flex h-full items-center gap-1.5 overflow-hidden px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        "text-muted-foreground hover:text-foreground",
        isActive && "text-foreground",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-white after:transition-transform after:duration-200",
        isActive ? "after:translate-y-0" : "after:translate-y-full",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
      {badge != null && badge > 0 ? (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-medium tabular-nums text-background"
          aria-label={`${badge} need attention`}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
