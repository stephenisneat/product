"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  PlusIcon,
  StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import { ImportShopifyDialog } from "@/features/products/import-shopify-dialog";
import { cn } from "@/lib/utils";

const COMING_SOON = [
  "WooCommerce",
  "BigCommerce",
  "Amazon",
  "Squarespace",
] as const;

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

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
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant={variant} size={size} className={className} />
          }
        >
          <PlusIcon data-icon="inline-start" />
          {label}
          <ChevronDownIcon data-icon="inline-end" className="opacity-70" />
        </PopoverTrigger>
        <PopoverContent align="end" className="min-w-56 p-2">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Create
          </p>
          <div className="space-y-0.5">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                setManualOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              Create manually
            </button>
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                setShopifyOpen(true);
              }}
            >
              <StoreIcon className="size-4" />
              Import from Shopify
            </button>
          </div>
          <Separator className="my-2" />
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Coming soon
          </p>
          <div className="space-y-0.5">
            {COMING_SOON.map((name) => (
              <button
                key={name}
                type="button"
                disabled
                className={cn(menuItemClass, "opacity-50")}
              >
                Import from {name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <CreateProductButton
        open={manualOpen}
        onOpenChange={setManualOpen}
        showTrigger={false}
      />
      <ImportShopifyDialog open={shopifyOpen} onOpenChange={setShopifyOpen} />
    </>
  );
}
