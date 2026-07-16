"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon, PlusIcon, StoreIcon } from "lucide-react";
import type { AppUser } from "@/domain";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import { ImportShopifyDialog } from "@/features/products/import-shopify-dialog";
import { cn } from "@/lib/utils";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);

  async function onSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const label = user.name?.trim() || user.email;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            showLabel && "px-1.5 py-1 hover:bg-white/5",
            !showLabel && "rounded-full",
          )}
        >
          <Avatar size="sm">
            <AvatarFallback>{initialsFor(user)}</AvatarFallback>
          </Avatar>
          {showLabel ? (
            <>
              <span className="max-w-40 truncate text-sm text-foreground">
                {label}
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : null}
          <span className="sr-only">Open account menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                {user.name ? (
                  <span className="text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                ) : null}
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              Create product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShopifyOpen(true)}>
              <StoreIcon />
              Import from Shopify
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/account" />}>
              Account
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateProductButton
        open={createOpen}
        onOpenChange={setCreateOpen}
        showTrigger={false}
      />
      <ImportShopifyDialog open={shopifyOpen} onOpenChange={setShopifyOpen} />
    </>
  );
}
