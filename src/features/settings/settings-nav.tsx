"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2Icon, CreditCardIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  {
    href: "/settings/billing",
    label: "Billing",
    icon: CreditCardIcon,
  },
] as const;

function isSettingsNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Settings">
      {settingsPages.map(({ href, label, icon: Icon }) => {
        const isActive = isSettingsNavActive(pathname, href);
        return (
          <Button
            key={href}
            render={<Link href={href} />}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            aria-current={isActive ? "page" : undefined}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        );
      })}
    </nav>
  );
}
