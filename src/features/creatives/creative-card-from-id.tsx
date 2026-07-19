"use client";

import { useEffect, useState } from "react";
import type { Creative } from "@/domain";
import { CreativeCard } from "@/features/creatives/creative-card";

/** Loads a creative by id for in-chat tool results. */
export function CreativeCardFromId({ creativeId }: { creativeId: string }) {
  const [creative, setCreative] = useState<Creative | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/creatives/${creativeId}`);
        if (!res.ok) {
          if (!cancelled) setError("Could not load creative");
          return;
        }
        const body = (await res.json()) as { creative?: Creative };
        if (!cancelled && body.creative) setCreative(body.creative);
      } catch {
        if (!cancelled) setError("Could not load creative");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creativeId]);

  if (error) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">{error}</p>
    );
  }
  if (!creative) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">Loading creative…</p>
    );
  }

  return (
    <div className="mt-2">
      <CreativeCard creative={creative} compact />
    </div>
  );
}
