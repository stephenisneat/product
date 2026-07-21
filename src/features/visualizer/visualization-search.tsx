"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  ChartLineIcon,
  ChartNoAxesCombinedIcon,
  GitBranchIcon,
  SearchIcon,
  XIcon,
  type IconComponent,
} from "@/components/icons";
import type { Visualization, VisualizationKind } from "@/domain";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CatalogHeaderActions } from "@/features/products/catalog-toolbar";
import { useVisualizationDraft } from "@/features/visualizer/visualization-draft-context";
import { listVisualizations } from "@/features/visualizer/visualization-store";
import { cn } from "@/lib/utils";

const kindIcon: Record<VisualizationKind, IconComponent> = {
  sankey: GitBranchIcon,
  timeseries: ChartLineIcon,
  comparison: ChartNoAxesCombinedIcon,
  bar: BarChart3Icon,
};

const kindLabel: Record<VisualizationKind, string> = {
  sankey: "Sankey",
  timeseries: "Timeseries",
  comparison: "Comparison",
  bar: "Bar",
};

function matchesQuery(viz: Visualization, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    viz.title.toLowerCase().includes(q) ||
    (viz.prompt?.toLowerCase().includes(q) ?? false) ||
    kindLabel[viz.kind].toLowerCase().includes(q)
  );
}

export function VisualizationSearch({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { confirmDiscardIfDirty } = useVisualizationDraft();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);

  const refresh = useCallback(() => {
    setVisualizations(listVisualizations(workspaceId));
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

  const results = useMemo(() => {
    return visualizations
      .filter((v) => matchesQuery(v, query))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 12);
  }, [visualizations, query]);

  function openViz(viz: Visualization) {
    const currentMatch = pathname.match(/^\/visualizer\/([^/]+)$/);
    const currentId = currentMatch?.[1] ?? null;
    if (currentId === viz.id) {
      setQuery("");
      setOpen(false);
      return;
    }
    if (!confirmDiscardIfDirty(currentId)) return;
    setQuery("");
    setOpen(false);
    router.push(`/visualizer/${viz.id}`);
  }

  return (
    <CatalogHeaderActions>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <div className="relative w-44 sm:w-56" />
          }
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search visualizations…"
            className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            aria-label="Search visualizations"
            aria-expanded={open}
            aria-controls="visualization-search-results"
            role="combobox"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
                setOpen(true);
              }}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-72 gap-0 p-1"
          id="visualization-search-results"
        >
          {results.length === 0 ? (
            <p className="px-2 py-3 text-muted-foreground">
              {visualizations.length === 0
                ? "No visualizations yet"
                : "No matching visualizations"}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto" role="listbox">
              {results.map((viz) => {
                const Icon = kindIcon[viz.kind];
                const active = pathname === `/visualizer/${viz.id}`;
                return (
                  <li key={viz.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent hover:text-accent-foreground",
                        active && "bg-accent/60",
                      )}
                      onClick={() => openViz(viz)}
                    >
                      <Icon className="size-3.5 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {viz.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {kindLabel[viz.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </CatalogHeaderActions>
  );
}
