"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlusIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { productStatusSchema } from "@/domain";
import { averageColorFromFile } from "@/lib/images/average-color";
import { createProductId, slugify } from "@/lib/products/slugify";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  handle: z
    .string()
    .min(1, "Handle is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens",
    ),
  description: z.string(),
  price: z.number().nonnegative("Price must be 0 or greater"),
  currency: z.string().min(1),
  status: productStatusSchema,
  sku: z.string(),
  category: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
const MAX_IMAGES = 6;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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
        const { data } = supabase.storage.from("product-assets").getPublicUrl(path);
        return data.publicUrl;
      })(),
      averageColorFromFile(image.file),
    ]);

    urls.push(publicUrl);
    avgColors.push(avgColor);
  }

  return { urls, avgColors };
}

export function CreateProductButton({
  variant = "default",
  size = "sm",
  label = "Product",
  className,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  showTrigger = true,
}: {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
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

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      handle: "",
      description: "",
      price: 0,
      currency: "USD",
      status: "draft",
      sku: "",
      category: "",
    },
  });

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
  const priceRegister = register("price", { valueAsNumber: true });

  function resetForm() {
    for (const image of images) {
      URL.revokeObjectURL(image.previewUrl);
    }
    setImages([]);
    setHandleTouched(false);
    setError(null);
    reset();
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

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          title: values.title.trim(),
          handle: values.handle.trim(),
          description: values.description.trim(),
          price: values.price,
          currency: values.currency,
          status: values.status,
          images: imageUrls,
          imageAvgColors,
          sku: values.sku.trim() || undefined,
          category: values.category.trim() || undefined,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { id: string };
      };

      if (!res.ok) {
        throw new Error(body.error || "Failed to create product");
      }

      toast.success("Product created");
      onOpenChange(false);
      router.push(`/products/${body.product?.id ?? productId}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create product";
      setError(message);
    }
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
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Add a product manually. Use Create product → Import from Shopify to
            pull from a connected store.
          </DialogDescription>
        </DialogHeader>

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
              placeholder="Aurora Insulated Bottle"
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
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-handle">Handle</Label>
            <Input
              id="product-handle"
              placeholder="aurora-insulated-bottle"
              {...handleRegister}
            />
            {errors.handle ? (
              <p className="text-xs text-destructive">{errors.handle.message}</p>
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
              placeholder="What makes this product worth buying?"
              className="min-h-24"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-price">Price</Label>
              <Input
                id="product-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                {...priceRegister}
              />
              {errors.price ? (
                <p className="text-xs text-destructive">{errors.price.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Controller
                control={control}
                name="currency"
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                placeholder="Optional"
                {...register("sku")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-category">Category</Label>
            <Input
              id="product-category"
              placeholder="e.g. Drinkware"
              {...register("category")}
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
