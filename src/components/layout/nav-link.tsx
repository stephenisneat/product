"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <Button
      render={<Link href={href} />}
      variant={isActive ? "secondary" : "outline"}
      size="sm"
      aria-current={isActive ? "page" : undefined}
    >
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  );
}
