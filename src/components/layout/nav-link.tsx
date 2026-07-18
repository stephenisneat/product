"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative inline-flex h-full items-center gap-1.5 overflow-hidden px-3 text-sm font-medium whitespace-nowrap transition-colors",
        "text-muted-foreground hover:text-foreground",
        isActive && "text-foreground",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-white after:transition-transform after:duration-200",
        isActive ? "after:translate-y-0" : "after:translate-y-full",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </Link>
  );
}
