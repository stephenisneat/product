"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  Building2Icon,
  CreditCardIcon,
  LightbulbIcon,
  Link2Icon,
  MonitorIcon,
  PuzzleIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
  UserIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      { href: "/settings/plugin", label: "Plugins", icon: PuzzleIcon },
    ],
  },
] as const;

function isSettingsNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = settingsGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !normalizedQuery ||
          item.label.toLowerCase().includes(normalizedQuery) ||
          group.label.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            aria-label="Search settings"
          />
          {query ? (
            <button
              type="button"
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-1"
        aria-label="Settings"
      >
        {filteredGroups.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No matching settings
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredGroups.map((group) => (
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
                      className={
                        isActive
                          ? "w-full justify-start"
                          : "w-full justify-start text-neutral-400"
                      }
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon data-icon="inline-start" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
