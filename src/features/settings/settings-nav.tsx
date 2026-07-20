"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  Building2Icon,
  CreditCardIcon,
  LightbulbIcon,
  Link2Icon,
  MonitorIcon,
  ShieldIcon,
  UsersIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const settingsGroups = [
  {
    label: "Personal",
    items: [
      { href: "/settings/profile", label: "Profile", icon: UserIcon },
      {
        href: "/settings/notifications",
        label: "Notifications",
        icon: BellIcon,
      },
      { href: "/settings/security", label: "Security", icon: ShieldIcon },
      {
        href: "/settings/appearance",
        label: "Appearance",
        icon: MonitorIcon,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/settings/workspace", label: "Profile", icon: Building2Icon },
      { href: "/settings/team", label: "Team", icon: UsersIcon },
      { href: "/settings/billing", label: "Billing", icon: CreditCardIcon },
      { href: "/settings/wallet", label: "Wallet", icon: WalletIcon },
      {
        href: "/settings/goals",
        label: "Insights",
        icon: LightbulbIcon,
      },
      {
        href: "/settings/connections",
        label: "Connections",
        icon: Link2Icon,
      },
    ],
  },
] as const;

function isSettingsNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6" aria-label="Settings">
      {settingsGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          {group.items.map(({ href, label, icon: Icon }) => {
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
        </div>
      ))}
    </nav>
  );
}
