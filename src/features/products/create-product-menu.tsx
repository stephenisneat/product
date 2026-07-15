"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  PlusIcon,
  StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const COMING_SOON = [
  "WooCommerce",
  "BigCommerce",
  "Amazon",
  "Squarespace",
] as const;

export function CreateProductMenu({
  variant = "default",
  size = "sm",
  label = "Create product",
  className,
}: {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant={variant} size={size} className={className} />
          }
        >
          <PlusIcon data-icon="inline-start" />
          {label}
          <ChevronDownIcon data-icon="inline-end" className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setManualOpen(true)}>
              <PlusIcon />
              Create manually
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShopifyOpen(true)}>
              <StoreIcon />
              Import from Shopify
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Coming soon</DropdownMenuLabel>
            {COMING_SOON.map((name) => (
              <DropdownMenuItem key={name} disabled>
                Import from {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateProductButton
        open={manualOpen}
        onOpenChange={setManualOpen}
        showTrigger={false}
      />
      <ImportShopifyDialog open={shopifyOpen} onOpenChange={setShopifyOpen} />
    </>
  );
}
