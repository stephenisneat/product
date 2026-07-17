"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2Icon,
  CalendarDaysIcon,
  ChevronRightIcon,
  GlobeIcon,
  PenLineIcon,
  PlusIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  StoreIcon,
  VoteIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ProductType } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import { ImportShopifyDialog } from "@/features/products/import-shopify-dialog";
import {
  PRODUCT_TYPE_OPTIONS,
  productTypeLabel,
} from "@/lib/products/product-type";
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

const TYPE_EXAMPLES: Record<ProductType, [string, string, string]> = {
  ecommerce: ["Nike sneakers", "Allbirds wool runners", "Glossier skincare"],
  mobile_app: ["Duolingo", "Strava", "Headspace"],
  website: ["Notion", "Linear", "Stripe"],
  brick_and_mortar: ["Apple Store", "Sweetgreen", "Warby Parker"],
  event: ["Coachella", "Web Summit", "F1 Grand Prix"],
  election: ["Presidential race", "Senate campaign", "Mayoral race"],
};

const optionCardClass =
  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background px-5 py-8 text-center outline-none transition-colors hover:border-foreground/20 hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

const optionGridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

type Step =
  | { kind: "type" }
  | { kind: "ecommerce-source" }
  | { kind: "create"; productType: ProductType }
  | { kind: "shopify" };

type Crumb = {
  label: string;
  onClick?: () => void;
};

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
  const [step, setStep] = useState<Step>({ kind: "type" });
  const [, startTransition] = useTransition();

  function resetFlow() {
    setStep({ kind: "type" });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetFlow();
    }
  }

  function selectType(type: ProductType) {
    if (type === "ecommerce") {
      setStep({ kind: "ecommerce-source" });
      return;
    }
    setStep({ kind: "create", productType: type });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("shopify");
    if (!status) return;

    const shop = params.get("shop");
    const reason = params.get("reason") ?? "unknown";

    params.delete("shopify");
    params.delete("shop");
    params.delete("reason");
    const next = params.toString();
    const path = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", path);

    if (status === "connected") {
      toast.success(shop ? `Connected to ${shop}` : "Shopify store connected");
      startTransition(() => {
        setOpen(true);
        setStep({ kind: "shopify" });
      });
    } else if (status === "error") {
      toast.error(`Shopify connection failed (${reason})`);
    }
  }, [startTransition]);

  const crumbs: Crumb[] = [
    {
      label: "Select type",
      onClick: step.kind === "type" ? undefined : () => setStep({ kind: "type" }),
    },
  ];

  if (step.kind === "ecommerce-source" || step.kind === "shopify") {
    crumbs.push({
      label: "Ecommerce",
      onClick:
        step.kind === "ecommerce-source"
          ? undefined
          : () => setStep({ kind: "ecommerce-source" }),
    });
  }

  if (step.kind === "create") {
    crumbs.push({
      label: productTypeLabel(step.productType),
      onClick:
        step.productType === "ecommerce"
          ? () => setStep({ kind: "ecommerce-source" })
          : undefined,
    });
    if (step.productType === "ecommerce") {
      crumbs.push({ label: "Manual" });
    }
  }

  if (step.kind === "shopify") {
    crumbs.push({ label: "Shopify" });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={variant} size={size} className={className} />
        }
      >
        <PlusIcon data-icon="inline-start" />
        {label}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/65 supports-backdrop-filter:backdrop-blur-xs"
        className="inset-10 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:inset-16 sm:max-w-none lg:inset-24"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <nav aria-label="Flow" className="min-w-0 flex-1">
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 ? (
                      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        className="truncate text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "truncate",
                          isLast
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <DialogTitle className="sr-only">
            {step.kind === "type"
              ? "What are you selling?"
              : step.kind === "ecommerce-source"
                ? "How do you want to add ecommerce products?"
                : step.kind === "shopify"
                  ? "Import from Shopify"
                  : `New ${productTypeLabel(step.productType).toLowerCase()}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new product or import from a connected store.
          </DialogDescription>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClose>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          {step.kind === "type" ? (
            <div className="flex flex-col gap-8">
              <h2 className="font-heading py-2 text-center text-3xl font-semibold tracking-tight sm:py-4 sm:text-4xl">
                What are you selling?
              </h2>
              <div className={optionGridClass}>
                {PRODUCT_TYPE_OPTIONS.map((option) => {
                  const Icon = TYPE_ICONS[option.value];
                  const examples = TYPE_EXAMPLES[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={optionCardClass}
                      onClick={() => selectType(option.value)}
                    >
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                        <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground/80">
                          {examples.join(" · ")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step.kind === "ecommerce-source" ? (
            <div className="flex flex-col gap-6">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                How do you want to add it?
              </h2>
              <div className={optionGridClass}>
                <button
                  type="button"
                  className={optionCardClass}
                  onClick={() => setStep({ kind: "shopify" })}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <StoreIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Shopify</span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
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
                      <span className="block text-sm font-medium">{name}</span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className={optionCardClass}
                  onClick={() =>
                    setStep({ kind: "create", productType: "ecommerce" })
                  }
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <PenLineIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Manual</span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                      Enter product details yourself
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {step.kind === "create" ? (
            <CreateProductButton
              embedded
              productType={step.productType}
              open
              onSuccess={() => handleOpenChange(false)}
              onOpenChange={(next) => {
                if (!next) {
                  if (step.productType === "ecommerce") {
                    setStep({ kind: "ecommerce-source" });
                  } else {
                    setStep({ kind: "type" });
                  }
                }
              }}
              showTrigger={false}
            />
          ) : null}

          <ImportShopifyDialog
            embedded
            open={step.kind === "shopify"}
            onSuccess={() => handleOpenChange(false)}
            onOpenChange={(next) => {
              if (next) {
                setOpen(true);
                setStep({ kind: "shopify" });
                return;
              }
              if (step.kind === "shopify") {
                setStep({ kind: "ecommerce-source" });
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
