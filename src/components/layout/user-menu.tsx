"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
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
            variant="ghost"
            size="sm"
            className={cn("text-xs", !showLabel && "rounded-full px-1.5")}
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
        <Link href="/settings/profile" className={menuItemClass}>
          Profile
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
