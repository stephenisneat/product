"use client";

import { useEffect, useState } from "react";
import type { Insight } from "@/domain";
import { InsightCard } from "@/features/insights/insight-card";

/** Loads an insight by id for in-chat tool results. */
export function InsightCardFromId({ insightId }: { insightId: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/insights/${insightId}`);
        if (!res.ok) {
          if (!cancelled) setError("Could not load insight");
          return;
        }
        const body = (await res.json()) as { insight?: Insight };
        if (!cancelled && body.insight) setInsight(body.insight);
      } catch {
        if (!cancelled) setError("Could not load insight");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [insightId]);

  if (error) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">{error}</p>
    );
  }
  if (!insight) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">Loading insight…</p>
    );
  }

  return (
    <div className="mt-2">
      <InsightCard insight={insight} compact />
    </div>
  );
}
