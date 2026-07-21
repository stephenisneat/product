"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  CalendarDaysIcon,
  GlobeIcon,
  PenLineIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  StoreIcon,
  VoteIcon,
} from "@/components/icons";
import { toast } from "sonner";
import type { CommerceProvider, ProductType } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import {
  CatalogToolbar,
  type CatalogBreadcrumb,
} from "@/features/products/catalog-toolbar";
import { CreateProductButton } from "@/features/products/create-product-dialog";
import {
  AMAZON_UI,
  BIGCOMMERCE_UI,
  SQUARESPACE_UI,
  WOOCOMMERCE_UI,
} from "@/features/products/commerce-provider-ui";
import { ImportCommerceDialog } from "@/features/products/import-commerce-dialog";
import { ImportShopifyDialog } from "@/features/products/import-shopify-dialog";
import {
  PRODUCT_TYPE_OPTIONS,
  productTypeLabel,
} from "@/lib/products/product-type";
import { cn } from "@/lib/utils";

const COMMERCE_SOURCES: {
  id: CommerceProvider;
  label: string;
  description: string;
}[] = [
  {
    id: "shopify",
    label: "Shopify",
    description: "Sync products from your Shopify store",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    description: "Sync products from your WooCommerce store",
  },
  {
    id: "bigcommerce",
    label: "BigCommerce",
    description: "Sync products from your BigCommerce store",
  },
  {
    id: "amazon",
    label: "Amazon",
    description: "Sync listings from Amazon Seller Central",
  },
  {
    id: "squarespace",
    label: "Squarespace",
    description: "Sync products from your Squarespace store",
  },
];

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

type CommerceStep = CommerceProvider;

type Step =
  | { kind: "type" }
  | { kind: "ecommerce-source" }
  | { kind: "create"; productType: ProductType }
  | { kind: "commerce"; provider: CommerceStep };

const PROVIDER_LABEL: Record<CommerceProvider, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  bigcommerce: "BigCommerce",
  amazon: "Amazon",
  squarespace: "Squarespace",
};

const OAUTH_QUERY_PARAMS: CommerceProvider[] = [
  "shopify",
  "bigcommerce",
  "amazon",
  "squarespace",
];

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

    for (const provider of OAUTH_QUERY_PARAMS) {
      const status = params.get(provider);
      if (!status) continue;

      const shop = params.get("shop");
      const reason = params.get("reason") ?? "unknown";

      params.delete(provider);
      params.delete("shop");
      params.delete("reason");
      const next = params.toString();
      const path = `${window.location.pathname}${next ? `?${next}` : ""}`;
      window.history.replaceState({}, "", path);

      if (status === "connected") {
        toast.success(
          shop
            ? `Connected to ${shop}`
            : `${PROVIDER_LABEL[provider]} store connected`,
        );
        startTransition(() => {
          setStep({ kind: "commerce", provider });
        });
      } else if (status === "error") {
        toast.error(
          `${PROVIDER_LABEL[provider]} connection failed (${reason})`,
        );
      }
      break;
    }
  }, [startTransition]);

  const crumbs: CatalogBreadcrumb[] = [
    { label: "Products", href: "/" },
    {
      label: "Select type",
      onClick: step.kind === "type" ? undefined : () => setStep({ kind: "type" }),
    },
  ];

  if (step.kind === "ecommerce-source" || step.kind === "commerce") {
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

  if (step.kind === "commerce") {
    crumbs.push({ label: PROVIDER_LABEL[step.provider] });
  }

  const title =
    step.kind === "type"
      ? "What are you selling?"
      : step.kind === "ecommerce-source"
        ? "Where do you sell your products?"
        : step.kind === "commerce"
          ? `Import from ${PROVIDER_LABEL[step.provider]}`
          : step.productType === "ecommerce"
            ? "Enter product details"
            : `Create your ${productTypeLabel(step.productType).toLowerCase()}`;

  function renderCommerceImport(provider: CommerceProvider) {
    const onOpenChange = (next: boolean) => {
      if (next) {
        setStep({ kind: "commerce", provider });
        return;
      }
      setStep({ kind: "ecommerce-source" });
    };

    if (provider === "shopify") {
      return (
        <ImportShopifyDialog
          embedded
          open
          onSuccess={closeFlow}
          onOpenChange={onOpenChange}
        />
      );
    }

    const config =
      provider === "woocommerce"
        ? WOOCOMMERCE_UI
        : provider === "bigcommerce"
          ? BIGCOMMERCE_UI
          : provider === "amazon"
            ? AMAZON_UI
            : SQUARESPACE_UI;

    return (
      <ImportCommerceDialog
        config={config}
        embedded
        open
        onSuccess={closeFlow}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <PageCanvas header={<CatalogToolbar breadcrumbs={crumbs} />}>
      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-6">
        <h1 className="mb-6 font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h1>
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
            {COMMERCE_SOURCES.map((source) => (
              <button
                key={source.id}
                type="button"
                className={optionCardClass}
                onClick={() =>
                  setStep({ kind: "commerce", provider: source.id })
                }
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <StoreIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {source.label}
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                    {source.description}
                  </span>
                </span>
              </button>
            ))}
            <button
              type="button"
              className={cn(optionCardClass)}
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

        {step.kind === "commerce" ? renderCommerceImport(step.provider) : null}
      </div>
    </PageCanvas>
  );
}
