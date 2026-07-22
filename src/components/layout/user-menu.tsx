"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";
import type { AppUser } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { cn } from "@/lib/utils";

const menuItemClass =
  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

export function UserMenu({
  user,
  showLabel = false,
  isPlatformAdmin = false,
}: {
  user: AppUser;
  showLabel?: boolean;
  isPlatformAdmin?: boolean;
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
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs",
              showLabel && "h-8 gap-1.5 px-1.5 text-neutral-400",
              !showLabel && "rounded-full px-1.5",
            )}
          />
        }
      >
        <UserAvatar
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          size="sm"
        />
        {showLabel ? (
          <>
            <span className="max-w-40 truncate font-medium">{label}</span>
            <ChevronDownIcon className="size-3 shrink-0 text-neutral-600 transition-[color,transform] duration-200 group-hover/button:text-neutral-300 group-aria-expanded/button:rotate-180 group-aria-expanded/button:text-neutral-300" />
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
        <Link href="/settings/profile" className={menuItemClass}>
          Profile
        </Link>
        {isPlatformAdmin ? (
          <Link href="/admin" className={menuItemClass}>
            Admin Center
          </Link>
        ) : null}
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
