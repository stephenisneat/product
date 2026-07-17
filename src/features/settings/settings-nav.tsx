"use client";

import { usePathname } from "next/navigation";
import { Building2Icon, UserIcon } from "lucide-react";
import { NavLink } from "@/components/layout/nav-link";

const settingsPages = [
  {
    href: "/settings/account",
    label: "Account",
    icon: UserIcon,
  },
  {
    href: "/settings/workspace",
    label: "Workspace",
    icon: Building2Icon,
  },
] as const;

function isSettingsNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Settings">
      {settingsPages.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          icon={icon}
          isActive={isSettingsNavActive(pathname, href)}
        />
      ))}
    </nav>
  );
}
