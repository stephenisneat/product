"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Loader2, PlusIcon } from "@/components/icons";
import { toast } from "sonner";
import type { Creative, Product } from "@/domain";
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

export function CreateSearchAdDialog({
  products,
  onCreated,
}: {
  products: Pick<Product, "id" | "title">[];
  onCreated?: (creative: Creative) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const briefId = useId();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setBrief("");
    setError(null);
    setSubmitting(false);
    if (products[0]) setProductId(products[0].id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError("Select a product.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!brief.trim()) {
      setError("Brief is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          title: title.trim(),
          brief: brief.trim(),
          kind: "search_ad",
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        creative?: Creative;
      };
      if (!res.ok || !body.creative) {
        throw new Error(body.error || "Could not start creative.");
      }

      onCreated?.(body.creative);
      toast.success("Search creative started");
      setOpen(false);
      resetForm();
      router.push(`/creatives/${body.creative.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start creative.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = products.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label="Create search ad"
          />
        }
      >
        <PlusIcon data-icon="inline-start" />
        Create search
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Create search ad</DialogTitle>
            <DialogDescription>
              Generate Responsive Search Ad copy, then keyword themes for Google
              Search.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-search-product">Product</Label>
              <Select
                value={productId}
                onValueChange={(value) => {
                  if (value) setProductId(value);
                }}
                disabled={disabled || submitting}
              >
                <SelectTrigger id="create-search-product" className="w-full">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={titleId}>Title</Label>
              <Input
                id={titleId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Summer search set"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={briefId}>Brief</Label>
              <Textarea
                id={briefId}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Audience, offer, search intent, tone…"
                disabled={submitting}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || disabled}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Starting…
                </>
              ) : (
                "Start generation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
