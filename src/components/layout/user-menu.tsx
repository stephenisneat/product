"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import type { AppUser } from "@/domain";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const menuItemClass =
  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

function initialsFor(user: AppUser) {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  user,
  showLabel = false,
}: {
  user: AppUser;
  showLabel?: boolean;
}) {
  const router = useRouter();

  async function onSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const label = user.name?.trim() || user.email;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(!showLabel && "rounded-full px-1.5")}
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initialsFor(user)}</AvatarFallback>
        </Avatar>
        {showLabel ? (
          <>
            <span className="max-w-40 truncate">{label}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180" />
          </>
        ) : null}
        <span className="sr-only">Open account menu</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="min-w-56 p-2">
        <div className="px-2 py-1.5">
          {user.name ? (
            <p className="text-sm font-medium text-foreground">{user.name}</p>
          ) : null}
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Separator className="my-2" />
        <Link
          href="/settings/account"
          className={menuItemClass}
        >
          Account
        </Link>
        <Separator className="my-2" />
        <button
          type="button"
          className={cn(menuItemClass, "text-destructive hover:text-destructive")}
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
