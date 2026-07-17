"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlusIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  mobileAppPlatformSchema,
  productStatusSchema,
  type ProductType,
  websiteSiteKindSchema,
} from "@/domain";
import { averageColorFromFile } from "@/lib/images/average-color";
import {
  optionalText,
  optionalUrl,
  productTypeLabel,
} from "@/lib/products/product-type";
import { createProductId, slugify } from "@/lib/products/slugify";

const optionalUrlField = z
  .string()
  .refine(
    (value) => !value.trim() || z.string().url().safeParse(value.trim()).success,
    "Enter a valid URL",
  );

const sharedFormFields = {
  title: z.string().min(1, "Title is required"),
  handle: z
    .string()
    .min(1, "Handle is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens",
    ),
  description: z.string(),
  status: productStatusSchema,
};

function formSchemaFor(type: ProductType) {
  switch (type) {
    case "ecommerce":
      return z.object({
        ...sharedFormFields,
        price: z.number().nonnegative("Price must be 0 or greater"),
        currency: z.string().min(1),
        sku: z.string(),
        category: z.string(),
        fulfillmentKind: z.enum(["physical", "digital"]),
      });
    case "mobile_app":
      return z.object({
        ...sharedFormFields,
        platforms: z
          .array(mobileAppPlatformSchema)
          .min(1, "Select at least one platform"),
        appStoreUrl: optionalUrlField,
        playStoreUrl: optionalUrlField,
        bundleId: z.string(),
        appCategory: z.string(),
      });
    case "website":
      return z.object({
        ...sharedFormFields,
        url: z.string().url("Enter a valid URL"),
        primaryDomain: z.string(),
        siteKind: websiteSiteKindSchema,
      });
    case "brick_and_mortar":
      return z.object({
        ...sharedFormFields,
        addressLine1: z.string().min(1, "Address is required"),
        addressLine2: z.string(),
        city: z.string().min(1, "City is required"),
        region: z.string().min(1, "Region is required"),
        postalCode: z.string().min(1, "Postal code is required"),
        country: z.string().min(1, "Country is required"),
        phone: z.string(),
        hours: z.string(),
        websiteUrl: optionalUrlField,
      });
    case "event":
      return z.object({
        ...sharedFormFields,
        startAt: z.string().min(1, "Start date is required"),
        endAt: z.string(),
        venue: z.string().min(1, "Venue is required"),
        address: z.string(),
        ticketUrl: optionalUrlField,
        capacity: z.union([
          z.nan(),
          z.number().int().positive("Capacity must be positive"),
        ]),
      });
    case "election":
      return z.object({
        ...sharedFormFields,
        electionDate: z.string().min(1, "Election date is required"),
        jurisdiction: z.string().min(1, "Jurisdiction is required"),
        office: z.string().min(1, "Office is required"),
        candidateName: z.string().min(1, "Candidate name is required"),
        party: z.string(),
      });
  }
}

type FormValues = z.infer<ReturnType<typeof formSchemaFor>>;

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
const MAX_IMAGES = 6;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PLATFORMS = [
  { value: "ios" as const, label: "iOS" },
  { value: "android" as const, label: "Android" },
  { value: "web" as const, label: "Web" },
];

type ImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

async function uploadProductImages(
  ownerId: string,
  productId: string,
  images: ImageDraft[],
): Promise<{ urls: string[]; avgColors: string[] }> {
  if (images.length === 0) return { urls: [], avgColors: [] };

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const urls: string[] = [];
  const avgColors: string[] = [];

  for (const [index, image] of images.entries()) {
    const [publicUrl, avgColor] = await Promise.all([
      (async () => {
        const path = `${ownerId}/${productId}/${index}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(image.file)}`;
        const { error } = await supabase.storage
          .from("product-assets")
          .upload(path, image.file, {
            cacheControl: "3600",
            contentType: image.file.type,
            upsert: false,
          });
        if (error) {
          throw new Error(error.message || "Failed to upload image");
        }
        const { data } = supabase.storage
          .from("product-assets")
          .getPublicUrl(path);
        return data.publicUrl;
      })(),
      averageColorFromFile(image.file),
    ]);

    urls.push(publicUrl);
    avgColors.push(avgColor);
  }

  return { urls, avgColors };
}

function defaultValuesFor(type: ProductType): FormValues {
  const shared = {
    title: "",
    handle: "",
    description: "",
    status: "draft" as const,
  };

  switch (type) {
    case "ecommerce":
      return {
        ...shared,
        price: 0,
        currency: "USD",
        sku: "",
        category: "",
        fulfillmentKind: "physical",
      };
    case "mobile_app":
      return {
        ...shared,
        platforms: ["ios"],
        appStoreUrl: "",
        playStoreUrl: "",
        bundleId: "",
        appCategory: "",
      };
    case "website":
      return {
        ...shared,
        url: "",
        primaryDomain: "",
        siteKind: "marketing",
      };
    case "brick_and_mortar":
      return {
        ...shared,
        addressLine1: "",
        addressLine2: "",
        city: "",
        region: "",
        postalCode: "",
        country: "US",
        phone: "",
        hours: "",
        websiteUrl: "",
      };
    case "event":
      return {
        ...shared,
        startAt: "",
        endAt: "",
        venue: "",
        address: "",
        ticketUrl: "",
        capacity: Number.NaN,
      };
    case "election":
      return {
        ...shared,
        electionDate: "",
        jurisdiction: "",
        office: "",
        candidateName: "",
        party: "",
      };
  }
}

function buildCreatePayload(
  type: ProductType,
  values: FormValues,
  productId: string,
  imageUrls: string[],
  imageAvgColors: string[],
) {
  const shared = {
    id: productId,
    title: values.title.trim(),
    handle: values.handle.trim(),
    description: values.description.trim(),
    status: values.status,
    images: imageUrls,
    imageAvgColors,
  };

  switch (type) {
    case "ecommerce": {
      const v = values as Extract<FormValues, { fulfillmentKind: string }>;
      return {
        ...shared,
        type,
        price: v.price,
        currency: v.currency,
        sku: optionalText(v.sku),
        category: optionalText(v.category),
        metadata: { fulfillmentKind: v.fulfillmentKind },
      };
    }
    case "mobile_app": {
      const v = values as Extract<FormValues, { platforms: string[] }>;
      return {
        ...shared,
        type,
        metadata: {
          platforms: v.platforms,
          appStoreUrl: optionalUrl(v.appStoreUrl),
          playStoreUrl: optionalUrl(v.playStoreUrl),
          bundleId: optionalText(v.bundleId),
          category: optionalText(v.appCategory),
        },
      };
    }
    case "website": {
      const v = values as Extract<FormValues, { url: string; siteKind: string }>;
      return {
        ...shared,
        type,
        metadata: {
          url: v.url.trim(),
          primaryDomain: optionalText(v.primaryDomain),
          siteKind: v.siteKind,
        },
      };
    }
    case "brick_and_mortar": {
      const v = values as Extract<FormValues, { addressLine1: string }>;
      return {
        ...shared,
        type,
        metadata: {
          addressLine1: v.addressLine1.trim(),
          addressLine2: optionalText(v.addressLine2),
          city: v.city.trim(),
          region: v.region.trim(),
          postalCode: v.postalCode.trim(),
          country: v.country.trim(),
          phone: optionalText(v.phone),
          hours: optionalText(v.hours),
          websiteUrl: optionalUrl(v.websiteUrl),
        },
      };
    }
    case "event": {
      const v = values as Extract<FormValues, { venue: string; startAt: string }>;
      return {
        ...shared,
        type,
        metadata: {
          startAt: v.startAt,
          endAt: optionalText(v.endAt),
          venue: v.venue.trim(),
          address: optionalText(v.address),
          ticketUrl: optionalUrl(v.ticketUrl),
          capacity:
            typeof v.capacity === "number" && !Number.isNaN(v.capacity)
              ? v.capacity
              : undefined,
        },
      };
    }
    case "election": {
      const v = values as Extract<FormValues, { candidateName: string }>;
      return {
        ...shared,
        type,
        metadata: {
          electionDate: v.electionDate,
          jurisdiction: v.jurisdiction.trim(),
          office: v.office.trim(),
          candidateName: v.candidateName.trim(),
          party: optionalText(v.party),
        },
      };
    }
  }
}

const TYPE_DESCRIPTIONS: Record<ProductType, string> = {
  ecommerce: "Add an ecommerce product with pricing and fulfillment details.",
  mobile_app: "Add a mobile or web app with store links and platforms.",
  website: "Add a website or web product with its primary URL.",
  brick_and_mortar: "Add a physical location with address and hours.",
  event: "Add an event with schedule, venue, and ticketing details.",
  election: "Add a candidate or race with jurisdiction and office.",
};

export function CreateProductButton({
  productType = "ecommerce",
  variant = "default",
  size = "sm",
  label = "Product",
  className,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  showTrigger = true,
  embedded = false,
  onSuccess,
}: {
  productType?: ProductType;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  embedded?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [handleTouched, setHandleTouched] = useState(false);

  const formSchema = useMemo(() => formSchemaFor(productType), [productType]);
  const defaults = useMemo(() => defaultValuesFor(productType), [productType]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaultValuesFor(productType));
  }, [productType, reset]);

  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  const titleRegister = register("title");
  const handleRegister = register("handle", {
    onChange: () => setHandleTouched(true),
  });
  const platforms = watch("platforms" as never) as
    | Array<"ios" | "android" | "web">
    | undefined;

  function resetForm() {
    for (const image of images) {
      URL.revokeObjectURL(image.previewUrl);
    }
    setImages([]);
    setHandleTouched(false);
    setError(null);
    reset(defaultValuesFor(productType));
  }

  function onOpenChange(next: boolean) {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChangeProp?.(next);
    if (!next) {
      resetForm();
    }
  }

  function addImages(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    const next: ImageDraft[] = [];
    for (const file of Array.from(fileList).slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported image type.`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 8MB.`);
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (next.length > 0) {
      setImages((prev) => [...prev, ...next]);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  }

  function togglePlatform(platform: "ios" | "android" | "web", checked: boolean) {
    const current = platforms ?? [];
    const next = checked
      ? [...new Set([...current, platform])]
      : current.filter((value) => value !== platform);
    setValue("platforms" as never, next as never, { shouldValidate: true });
  }

  async function onSubmit(values: FormValues) {
    setError(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be signed in to create a product.");
        return;
      }

      const productId = createProductId();
      const { urls: imageUrls, avgColors: imageAvgColors } =
        await uploadProductImages(user.id, productId, images);

      const payload = buildCreatePayload(
        productType,
        values,
        productId,
        imageUrls,
        imageAvgColors,
      );

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { id: string };
      };

      if (!res.ok) {
        throw new Error(body.error || "Failed to create product");
      }

      toast.success(`${productTypeLabel(productType)} created`);
      if (onSuccess) {
        resetForm();
        if (!isControlled) {
          setUncontrolledOpen(false);
        }
        onSuccess();
      } else {
        onOpenChange(false);
      }
      router.push(`/products/${body.product?.id ?? productId}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create product";
      setError(message);
    }
  }

  const typeLabel = productTypeLabel(productType);
  const fieldErrors = errors as Record<string, { message?: string } | undefined>;

  if (embedded && !open) {
    return null;
  }

  const form = (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fileInputId}>Images</Label>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(event) => {
                addImages(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-md bg-background/90 text-foreground ring-1 ring-border"
                    aria-label="Remove image"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <ImagePlusIcon className="size-5" />
                  <span className="text-[11px]">Add</span>
                </button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Up to {MAX_IMAGES} images · JPG, PNG, WebP, or GIF · 8MB each
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-title">Title</Label>
            <Input
              id="product-title"
              placeholder={
                productType === "election"
                  ? "Jordan Lee for Senate"
                  : productType === "event"
                    ? "Summer Launch Night"
                    : "Product name"
              }
              {...titleRegister}
              onChange={(event) => {
                void titleRegister.onChange(event);
                if (!handleTouched) {
                  setValue("handle", slugify(event.target.value), {
                    shouldValidate: false,
                  });
                }
              }}
            />
            {fieldErrors.title ? (
              <p className="text-xs text-destructive">{fieldErrors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-handle">Handle</Label>
            <Input
              id="product-handle"
              placeholder="url-friendly-handle"
              {...handleRegister}
            />
            {fieldErrors.handle ? (
              <p className="text-xs text-destructive">
                {fieldErrors.handle.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-fills from the title.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              placeholder="What should people know about this?"
              className="min-h-24"
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {productType === "ecommerce" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="product-price">Price</Label>
                  <Input
                    id="product-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    {...register("price" as never, { valueAsNumber: true })}
                  />
                  {fieldErrors.price ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.price.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Controller
                    control={control}
                    name={"currency" as never}
                    render={({ field }) => (
                      <Select
                        value={field.value as string}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fulfillment</Label>
                <Controller
                  control={control}
                  name={"fulfillmentKind" as never}
                  render={({ field }) => (
                    <Select
                      value={field.value as string}
                      onValueChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input
                    id="product-sku"
                    placeholder="Optional"
                    {...register("sku" as never)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <Input
                    id="product-category"
                    placeholder="e.g. Drinkware"
                    {...register("category" as never)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {productType === "mobile_app" ? (
            <>
              <div className="space-y-2">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-4">
                  {PLATFORMS.map((platform) => (
                    <label
                      key={platform.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={platforms?.includes(platform.value) ?? false}
                        onCheckedChange={(checked) =>
                          togglePlatform(platform.value, checked === true)
                        }
                      />
                      {platform.label}
                    </label>
                  ))}
                </div>
                {fieldErrors.platforms ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.platforms.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-store-url">App Store URL</Label>
                <Input
                  id="app-store-url"
                  placeholder="https://apps.apple.com/..."
                  {...register("appStoreUrl" as never)}
                />
                {fieldErrors.appStoreUrl ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.appStoreUrl.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="play-store-url">Play Store URL</Label>
                <Input
                  id="play-store-url"
                  placeholder="https://play.google.com/..."
                  {...register("playStoreUrl" as never)}
                />
                {fieldErrors.playStoreUrl ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.playStoreUrl.message}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bundle-id">Bundle ID</Label>
                  <Input
                    id="bundle-id"
                    placeholder="com.example.app"
                    {...register("bundleId" as never)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-category">Category</Label>
                  <Input
                    id="app-category"
                    placeholder="Productivity"
                    {...register("appCategory" as never)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {productType === "website" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="website-url">URL</Label>
                <Input
                  id="website-url"
                  placeholder="https://example.com"
                  {...register("url" as never)}
                />
                {fieldErrors.url ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.url.message}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="primary-domain">Primary domain</Label>
                  <Input
                    id="primary-domain"
                    placeholder="example.com"
                    {...register("primaryDomain" as never)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site kind</Label>
                  <Controller
                    control={control}
                    name={"siteKind" as never}
                    render={({ field }) => (
                      <Select
                        value={field.value as string}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="saas">SaaS</SelectItem>
                          <SelectItem value="content">Content</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </>
          ) : null}

          {productType === "brick_and_mortar" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="address-line-1">Address</Label>
                <Input
                  id="address-line-1"
                  placeholder="123 Main St"
                  {...register("addressLine1" as never)}
                />
                {fieldErrors.addressLine1 ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.addressLine1.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-line-2">Address line 2</Label>
                <Input
                  id="address-line-2"
                  placeholder="Suite 200"
                  {...register("addressLine2" as never)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...register("city" as never)} />
                  {fieldErrors.city ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.city.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">State / region</Label>
                  <Input id="region" {...register("region" as never)} />
                  {fieldErrors.region ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.region.message}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="postal-code">Postal code</Label>
                  <Input id="postal-code" {...register("postalCode" as never)} />
                  {fieldErrors.postalCode ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.postalCode.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...register("country" as never)} />
                  {fieldErrors.country ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.country.message}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="Optional"
                    {...register("phone" as never)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    placeholder="Mon–Fri 9–5"
                    {...register("hours" as never)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-website">Website</Label>
                <Input
                  id="store-website"
                  placeholder="https://..."
                  {...register("websiteUrl" as never)}
                />
                {fieldErrors.websiteUrl ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.websiteUrl.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {productType === "event" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-at">Starts</Label>
                  <Input
                    id="start-at"
                    type="datetime-local"
                    {...register("startAt" as never)}
                  />
                  {fieldErrors.startAt ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.startAt.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-at">Ends</Label>
                  <Input
                    id="end-at"
                    type="datetime-local"
                    {...register("endAt" as never)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  placeholder="The Grand Hall"
                  {...register("venue" as never)}
                />
                {fieldErrors.venue ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.venue.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-address">Address</Label>
                <Input
                  id="event-address"
                  placeholder="Optional"
                  {...register("address" as never)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ticket-url">Ticket URL</Label>
                  <Input
                    id="ticket-url"
                    placeholder="https://..."
                    {...register("ticketUrl" as never)}
                  />
                  {fieldErrors.ticketUrl ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.ticketUrl.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Optional"
                    {...register("capacity" as never, { valueAsNumber: true })}
                  />
                  {fieldErrors.capacity ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.capacity.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {productType === "election" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="candidate-name">Candidate</Label>
                <Input
                  id="candidate-name"
                  placeholder="Jordan Lee"
                  {...register("candidateName" as never)}
                />
                {fieldErrors.candidateName ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.candidateName.message}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="office">Office</Label>
                  <Input
                    id="office"
                    placeholder="U.S. Senate"
                    {...register("office" as never)}
                  />
                  {fieldErrors.office ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.office.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party">Party</Label>
                  <Input
                    id="party"
                    placeholder="Optional"
                    {...register("party" as never)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="jurisdiction">Jurisdiction</Label>
                  <Input
                    id="jurisdiction"
                    placeholder="California"
                    {...register("jurisdiction" as never)}
                  />
                  {fieldErrors.jurisdiction ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.jurisdiction.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="election-date">Election date</Label>
                  <Input
                    id="election-date"
                    type="date"
                    {...register("electionDate" as never)}
                  />
                  {fieldErrors.electionDate ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.electionDate.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter
            className={
              embedded
                ? "mx-0 mb-0 rounded-xl border border-border bg-muted/40"
                : "pt-2"
            }
          >
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : `Create ${typeLabel.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
  );

  if (embedded) {
    return <div className="mx-auto w-full max-w-lg">{form}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <DialogTrigger
          render={<Button variant={variant} size={size} className={className} />}
        >
          <PlusIcon data-icon="inline-start" />
          {label}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New {typeLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>{TYPE_DESCRIPTIONS[productType]}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
