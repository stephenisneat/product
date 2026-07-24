"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { cn } from "@/lib/utils";

const menuItemClass =
  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

export function UserMenu({
  user,
  isPlatformAdmin = false,
}: {
  user: AppUser;
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
      <Tooltip>
        <TooltipTrigger
          delay={50}
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 rounded-lg text-neutral-400"
                  aria-label="Open account menu"
                />
              }
            />
          }
        >
          <UserAvatar
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
            size="sm"
          />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="end" sideOffset={8} className="min-w-56 p-2">
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
