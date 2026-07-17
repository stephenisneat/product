"use client";

import { useState } from "react";
import {
  Building2Icon,
  CalendarDaysIcon,
  GlobeIcon,
  PlusIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  StoreIcon,
  VoteIcon,
} from "lucide-react";
import type { ProductType } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import { ImportShopifyDialog } from "@/features/products/import-shopify-dialog";
import { PRODUCT_TYPE_OPTIONS } from "@/lib/products/product-type";
import { cn } from "@/lib/utils";

const COMING_SOON = [
  "WooCommerce",
  "BigCommerce",
  "Amazon",
  "Squarespace",
] as const;

const TYPE_ICONS: Record<ProductType, typeof ShoppingBagIcon> = {
  ecommerce: ShoppingBagIcon,
  mobile_app: SmartphoneIcon,
  website: GlobeIcon,
  brick_and_mortar: Building2Icon,
  event: CalendarDaysIcon,
  election: VoteIcon,
};

const optionCardClass =
  "flex h-full min-h-0 flex-col items-start gap-3 rounded-xl border border-border bg-background p-4 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

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
  const [productType, setProductType] = useState<ProductType>("ecommerce");
  const [shopifyOpen, setShopifyOpen] = useState(false);

  function openType(type: ProductType) {
    setOpen(false);
    setProductType(type);
    setManualOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant={variant} size={size} className={className} />
          }
        >
          <PlusIcon data-icon="inline-start" />
          {label}
        </DialogTrigger>
        <DialogContent className="inset-10 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden p-6 sm:inset-16 sm:max-w-none lg:inset-24">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add products</DialogTitle>
            <DialogDescription>
              Create a new product or import from a connected store.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
            <section className="flex min-h-0 flex-1 flex-col gap-3">
              <h3 className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Create
              </h3>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-3">
                {PRODUCT_TYPE_OPTIONS.map((option) => {
                  const Icon = TYPE_ICONS[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={optionCardClass}
                      onClick={() => openType(option.value)}
                    >
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col gap-3">
              <h3 className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Import
              </h3>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-3">
                <button
                  type="button"
                  className={optionCardClass}
                  onClick={() => {
                    setOpen(false);
                    setShopifyOpen(true);
                  }}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <StoreIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      Import from Shopify
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Sync products from your Shopify store
                    </span>
                  </span>
                </button>
                {COMING_SOON.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled
                    className={cn(optionCardClass, "opacity-50")}
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                      <StoreIcon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        Import from {name}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <CreateProductButton
        productType={productType}
        open={manualOpen}
        onOpenChange={setManualOpen}
        showTrigger={false}
      />
      <ImportShopifyDialog open={shopifyOpen} onOpenChange={setShopifyOpen} />
    </>
  );
}
