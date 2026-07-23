"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, XIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ProductImageLightbox({
  open,
  onOpenChange,
  images,
  avgColors = [],
  title,
  initialIndex = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  avgColors?: Array<string | null | undefined>;
  title: string;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const count = images.length;
  const current = images[index];
  const avgColor = avgColors[index];

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)));
  }, [open, initialIndex, count]);

  useEffect(() => {
    if (!open || count < 2) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((i) => (i - 1 + count) % count);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((i) => (i + 1) % count);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, count]);

  if (count === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/85 supports-backdrop-filter:backdrop-blur-sm"
        className="flex max-h-[min(92vh,920px)] w-full max-w-[min(96vw,960px)] flex-col gap-3 border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[min(96vw,960px)]"
      >
        <DialogTitle className="sr-only">{title} images</DialogTitle>

        <div className="flex items-center justify-between gap-3 px-1">
          <p className="truncate text-sm text-white/80">
            {title}
            {count > 1 ? (
              <span className="ml-2 font-mono text-xs text-white/50">
                {index + 1} / {count}
              </span>
            ) : null}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close gallery"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {count > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute left-1 z-10 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:left-2"
              aria-label="Previous image"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}

          <div
            className="relative mx-auto aspect-square w-full max-h-[min(70vh,720px)] max-w-[min(70vh,720px)] overflow-hidden rounded-lg"
            style={avgColor ? { backgroundColor: avgColor } : undefined}
          >
            {current ? (
              <Image
                src={current}
                alt={`${title} image ${index + 1}`}
                fill
                sizes="(max-width: 960px) 96vw, 720px"
                className="object-contain"
                priority
              />
            ) : null}
          </div>

          {count > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 z-10 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:right-2"
              aria-label="Next image"
              onClick={() => setIndex((i) => (i + 1) % count)}
            >
              <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="flex justify-center gap-2 overflow-x-auto px-1 pb-1">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative size-12 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-black transition",
                  i === index
                    ? "ring-2 ring-white"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <ProductImage
                  src={src}
                  avgColor={avgColors[i]}
                  className="size-full"
                  sizes="48px"
                />
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
