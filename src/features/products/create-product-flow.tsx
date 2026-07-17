"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  CalendarDaysIcon,
  ChevronRightIcon,
  GlobeIcon,
  PenLineIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  StoreIcon,
  VoteIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ProductType } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { CatalogToolbar } from "@/features/products/catalog-toolbar";
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

export function CreateProductFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "type" });
  const [, startTransition] = useTransition();

  function closeFlow() {
    router.push("/");
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

  const title =
    step.kind === "type"
      ? "What are you selling?"
      : step.kind === "ecommerce-source"
        ? "Where do you sell your products?"
        : step.kind === "shopify"
          ? "Import from Shopify"
          : step.productType === "ecommerce"
            ? "Enter product details"
            : `Create your ${productTypeLabel(step.productType).toLowerCase()}`;

  return (
    <PageCanvas header={<CatalogToolbar title={title} />}>
      <div className="sticky top-0 z-10 border-b border-border bg-canvas/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-canvas/80">
        <nav aria-label="Flow">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li
                  key={`${crumb.label}-${index}`}
                  className="flex items-center gap-1"
                >
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
      </div>

      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-6">
        {step.kind === "type" ? (
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
        ) : null}

        {step.kind === "ecommerce-source" ? (
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
        ) : null}

        {step.kind === "create" ? (
          <CreateProductButton
            embedded
            productType={step.productType}
            open
            onSuccess={() => {
              // CreateProductButton navigates to the new product.
            }}
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

        {step.kind === "shopify" ? (
          <ImportShopifyDialog
            embedded
            open
            onSuccess={closeFlow}
            onOpenChange={(next) => {
              if (next) {
                setStep({ kind: "shopify" });
                return;
              }
              setStep({ kind: "ecommerce-source" });
            }}
          />
        ) : null}
      </div>
    </PageCanvas>
  );
}
