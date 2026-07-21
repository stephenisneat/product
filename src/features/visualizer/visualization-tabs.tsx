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
  type IconComponent,
} from "@/components/icons";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import type { Visualization, VisualizationKind } from "@/domain";
import { useVisualizationDraft } from "@/features/visualizer/visualization-draft-context";
import {
  closeVisualizationTab,
  getVisualization,
  loadVisualizationStore,
  reorderVisualizationTabs,
  type VisualizationStore,
} from "@/features/visualizer/visualization-store";
import { cn } from "@/lib/utils";

const kindIcon: Record<VisualizationKind, IconComponent> = {
  sankey: GitBranchIcon,
  timeseries: ChartLineIcon,
  comparison: ChartNoAxesCombinedIcon,
  bar: BarChart3Icon,
};

function moveIdBefore(ids: string[], fromId: string, toId: string) {
  if (fromId === toId) return ids;
  const from = ids.indexOf(fromId);
  if (from < 0 || ids.indexOf(toId) < 0) return ids;
  const next = [...ids];
  next.splice(from, 1);
  const insertAt = next.indexOf(toId);
  if (insertAt < 0) return ids;
  next.splice(insertAt, 0, fromId);
  return next;
}

function activeVisualizationId(pathname: string): string | null {
  const match = pathname.match(/^\/visualizer\/([^/]+)$/);
  return match?.[1] ?? null;
}

export function VisualizationTabs({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDirty, confirmDiscardIfDirty, discardDraft } =
    useVisualizationDraft();
  // SSR-safe default; localStorage is read after mount to avoid hydration mismatch.
  const [store, setStore] = useState<VisualizationStore | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

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

  const openTabIds = draftOrder ?? store?.openTabIds ?? [];
  const openTabs: Visualization[] = openTabIds
    .map((id) => getVisualization(workspaceId, id))
    .filter((v): v is Visualization => v != null);

  const isNewActive =
    pathname === "/visualizer" || pathname === "/visualizer/";
  const currentId = activeVisualizationId(pathname);

  function navigateTo(href: string) {
    if (pathname === href) return;
    if (!confirmDiscardIfDirty(currentId)) return;
    router.push(href);
  }

  function handleClose(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDiscardIfDirty(id)) return;

    discardDraft(id);
    const next = closeVisualizationTab(workspaceId, id);
    window.dispatchEvent(new Event("visualizations-changed"));
    setStore(next);
    setDraftOrder(null);
    draggingIdRef.current = null;
    setDraggingId(null);

    if (pathname === `/visualizer/${id}`) {
      const remaining = next.openTabIds;
      if (remaining.length > 0) {
        router.push(`/visualizer/${remaining[remaining.length - 1]}`);
      } else {
        router.push("/visualizer");
      }
    }
  }

  function handleTabMouseDown(e: MouseEvent, href: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    // Active tab has no navigation — keeps mousedown from fighting drag-reorder.
    if (pathname === href) return;
    navigateTo(href);
  }

  function handleDragStart(e: DragEvent, id: string) {
    draggingIdRef.current = id;
    setDraggingId(id);
    setDraftOrder(openTabIds);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Transparent drag image keeps the tab strip readable while reordering.
    const ghost = document.createElement("div");
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  }

  function handleDragOver(e: DragEvent, overId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const fromId = draggingIdRef.current;
    if (!fromId || fromId === overId) return;
    setDraftOrder((prev) => {
      const ids = prev ?? openTabIds;
      const next = moveIdBefore(ids, fromId, overId);
      return next === ids || next.every((id, i) => id === ids[i]) ? prev : next;
    });
  }

  function handleDragEnd() {
    if (draftOrder) {
      const next = reorderVisualizationTabs(workspaceId, draftOrder);
      setStore(next);
      window.dispatchEvent(new Event("visualizations-changed"));
    }
    draggingIdRef.current = null;
    setDraftOrder(null);
    setDraggingId(null);
  }

  return (
    <div className="flex h-10 items-stretch overflow-x-auto bg-canvas w-full">
      {openTabs.map((tab) => {
        const href = `/visualizer/${tab.id}`;
        const active = pathname === href;
        const Icon = kindIcon[tab.kind];
        const isDragging = draggingId === tab.id;
        const dirty = isDirty(tab.id);
        const label = (
          <>
            <Icon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">{tab.title}</span>
          </>
        );
        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => {
              if (active) return;
              if ((e.target as HTMLElement).closest("[data-tab-close]")) return;
              handleTabMouseDown(e, href);
            }}
            className={cn(
              "group relative flex max-w-[200px] items-center gap-1 px-2 text-xs font-medium border-r border-b border-border pt-1 cursor-pointer",
              active
                ? "bg-neutral-900 text-foreground border-b-neutral-900"
                : "bg-canvas hover:bg-neutral-700/20 text-muted-foreground",
              isDragging && "opacity-50",
              draggingId && "cursor-grabbing",
            )}
          >
            {active ? (
              <span
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1.5"
                title={tab.title}
                aria-current="page"
              >
                {label}
              </span>
            ) : (
              <Link
                href={href}
                draggable={false}
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1.5"
                title={tab.title}
                onClick={(e) => {
                  if (
                    e.button !== 0 ||
                    e.metaKey ||
                    e.ctrlKey ||
                    e.shiftKey ||
                    e.altKey
                  ) {
                    return;
                  }
                  e.preventDefault();
                }}
              >
                {label}
              </Link>
            )}
            <button
              type="button"
              data-tab-close
              aria-label={
                dirty ? `Close ${tab.title} (unsaved)` : `Close ${tab.title}`
              }
              className={cn(
                "group/close relative flex size-5 shrink-0 items-center justify-center rounded p-0.5 hover:bg-neutral-700/20 hover:opacity-100",
                dirty
                  ? "opacity-100"
                  : active
                    ? "opacity-60"
                    : "opacity-0 group-hover:opacity-60 focus-visible:opacity-60",
              )}
              onClick={(e) => handleClose(e, tab.id)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {dirty ? (
                <>
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-current group-hover/close:hidden"
                  />
                  <XIcon className="hidden size-3.5 group-hover/close:block" />
                </>
              ) : (
                <XIcon className="size-3.5" />
              )}
            </button>
          </div>
        );
      })}
      <div
        onMouseDown={(e) => {
          if (isNewActive) return;
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return;
          }
          navigateTo("/visualizer");
        }}
        className={cn(
          "cursor-pointer h-10 w-10 shrink-0 border-t-0 border-l-0 border-r border-b border-border rounded-none flex items-center justify-center pt-1",
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
