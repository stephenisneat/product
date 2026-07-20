"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Creative } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { CreativeCard } from "@/features/creatives/creative-card";

/**
 * List view that coalesces generating-creative polls into one workspace
 * fetch instead of N per-card `/api/creatives/:id` intervals.
 *
 * Remount via `key` when server creatives change (e.g. after router.refresh).
 */
export function CreativesList({
  initialCreatives,
  productTitleById,
}: {
  initialCreatives: Creative[];
  productTitleById: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creatives, setCreatives] = useState(initialCreatives);
  const hasGenerating = creatives.some((c) => c.status === "generating");

  useEffect(() => {
    if (!hasGenerating) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/creatives");
        if (!res.ok) return;
        const body = (await res.json()) as { creatives?: Creative[] };
        if (cancelled || !body.creatives) return;
        setCreatives(body.creatives);
        if (!body.creatives.some((c) => c.status === "generating")) {
          startTransition(() => router.refresh());
        }
      } catch {
        // ignore poll errors
      }
    };

    const id = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasGenerating, router]);

  return (
    <ul className="space-y-3">
      {creatives.map((creative) => (
        <li key={creative.id}>
          <div className="mb-1.5 flex items-center gap-2 px-0.5">
            <Link
              href={`/creatives/${creative.id}`}
              className="text-xs font-medium hover:underline"
            >
              Open detail
            </Link>
            <Badge variant="outline" className="text-[10px]">
              {productTitleById[creative.productId] ?? "Product"}
            </Badge>
          </div>
          <CreativeCard creative={creative} pollWhileGenerating={false} />
        </li>
      ))}
    </ul>
  );
}
