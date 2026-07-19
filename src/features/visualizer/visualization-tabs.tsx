"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { Visualization } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  closeVisualizationTab,
  getVisualization,
  loadVisualizationStore,
  type VisualizationStore,
} from "@/features/visualizer/visualization-store";
import { cn } from "@/lib/utils";

export function VisualizationTabs({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // SSR-safe default; localStorage is read after mount to avoid hydration mismatch.
  const [store, setStore] = useState<VisualizationStore | null>(null);

  const refresh = useCallback(() => {
    setStore(loadVisualizationStore(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    refresh();
    function onStorage(e: StorageEvent) {
      if (e.key === `visualizations:${workspaceId}`) refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("visualizations-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("visualizations-changed", refresh);
    };
  }, [refresh, workspaceId]);

  const openTabs: Visualization[] =
    store?.openTabIds
      .map((id) => getVisualization(workspaceId, id))
      .filter((v): v is Visualization => v != null) ?? [];

  const isNewActive =
    pathname === "/visualizer" || pathname === "/visualizer/";

  function handleClose(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const next = closeVisualizationTab(workspaceId, id);
    window.dispatchEvent(new Event("visualizations-changed"));
    setStore(next);

    if (pathname === `/visualizer/${id}`) {
      const remaining = next.openTabIds;
      if (remaining.length > 0) {
        router.push(`/visualizer/${remaining[remaining.length - 1]}`);
      } else {
        router.push("/visualizer");
      }
    }
  }

  return (
    <div className="flex h-10 items-stretch gap-0.5 overflow-x-auto border-b border-border bg-canvas/80 px-2">
      {openTabs.map((tab) => {
        const href = `/visualizer/${tab.id}`;
        const active = pathname === href;
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex max-w-[200px] items-center gap-1 rounded-t-md border border-b-0 px-2 text-sm",
              active
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Link
              href={href}
              className="min-w-0 flex-1 truncate py-1.5"
              title={tab.title}
            >
              {tab.title}
            </Link>
            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              className="rounded p-0.5 opacity-60 hover:bg-muted hover:opacity-100"
              onClick={(e) => handleClose(e, tab.id)}
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
      <Button
        type="button"
        variant={isNewActive ? "secondary" : "ghost"}
        size="icon-sm"
        className="my-1 shrink-0"
        aria-label="New visualization"
        onClick={() => router.push("/visualizer")}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
