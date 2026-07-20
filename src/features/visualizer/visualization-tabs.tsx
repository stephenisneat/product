"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  ChartLineIcon,
  ChartNoAxesCombinedIcon,
  GitBranchIcon,
  PlusIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { Visualization, VisualizationKind } from "@/domain";
import {
  closeVisualizationTab,
  getVisualization,
  loadVisualizationStore,
  type VisualizationStore,
} from "@/features/visualizer/visualization-store";
import { cn } from "@/lib/utils";

const kindIcon: Record<VisualizationKind, LucideIcon> = {
  sankey: GitBranchIcon,
  timeseries: ChartLineIcon,
  comparison: ChartNoAxesCombinedIcon,
  bar: BarChart3Icon,
};

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

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-10 items-stretch overflow-x-auto bg-canvas w-full">
      {openTabs.map((tab) => {
        const href = `/visualizer/${tab.id}`;
        const active = pathname === href;
        const Icon = kindIcon[tab.kind];
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex max-w-[200px] items-center gap-1 px-2 text-xs font-medium border-r border-b border-border pt-1 cursor-pointer",
              active
                ? "bg-neutral-900 text-foreground border-b-neutral-900"
                : "bg-canvas hover:bg-neutral-700/20 text-muted-foreground",
            )}
          >
            <Link
              href={href}
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1.5"
              title={tab.title}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{tab.title}</span>
            </Link>
            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              className={cn(
                "rounded p-0.5 hover:bg-neutral-700/20 hover:opacity-100",
                active
                  ? "opacity-60"
                  : "opacity-0 group-hover:opacity-60 focus-visible:opacity-60",
              )}
              onClick={(e) => handleClose(e, tab.id)}
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
      <div
        onClick={() => router.push("/visualizer")}
        className={cn(
          "cursor-pointer h-10 w-10 shrink-0 border-t-0 border-l-0 border-r border-b border-border rounded-none flex items-center justify-center",
          isNewActive
            ? "bg-neutral-900 border-b-neutral-900"
            : "bg-canvas hover:bg-neutral-700/20 text-muted-foreground",
        )}
      >
        <PlusIcon className="size-3.5" />
      </div>

      <div className="h-full w-full border-b border-border" />
    </div>
  );
}
