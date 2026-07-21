"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Visualization } from "@/domain";
import { flattenVisualization } from "@/features/visualizer/explore/flatten";
import { rebuildChartData } from "@/features/visualizer/explore/transform";
import type { VizExploreConfig } from "@/features/visualizer/explore/types";
import {
  installNavigationGuards,
  setNavigationGuard,
} from "@/features/visualizer/navigation-guard";
import { saveVisualizationEdits } from "@/features/visualizer/visualization-store";

export function configsEqual(a: VizExploreConfig, b: VizExploreConfig) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

type VisualizationDraftContextValue = {
  isDirty: (id: string) => boolean;
  dirtyCount: number;
  getDraft: (id: string) => VizExploreConfig | undefined;
  setDraft: (
    id: string,
    config: VizExploreConfig,
    baseline: VizExploreConfig,
  ) => void;
  discardDraft: (id: string) => void;
  saveDraft: (
    workspaceId: string,
    viz: Visualization,
    config: VizExploreConfig,
  ) => Visualization | null;
  /** Returns true if navigation should proceed. */
  confirmDiscardIfDirty: (id: string | null | undefined) => boolean;
};

const VisualizationDraftContext =
  createContext<VisualizationDraftContextValue | null>(null);

export function VisualizationDraftProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, VizExploreConfig>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const bypassUntilRef = useRef(0);

  const discardAllSync = useCallback(() => {
    draftsRef.current = {};
    setDrafts({});
    // Avoid a second confirm from history/Navigation API after Link click.
    bypassUntilRef.current = Date.now() + 1000;
  }, []);

  const isDirty = useCallback(
    (id: string) => Object.prototype.hasOwnProperty.call(drafts, id),
    [drafts],
  );

  const dirtyCount = useMemo(() => Object.keys(drafts).length, [drafts]);

  const getDraft = useCallback((id: string) => drafts[id], [drafts]);

  const setDraft = useCallback(
    (id: string, config: VizExploreConfig, baseline: VizExploreConfig) => {
      setDrafts((prev) => {
        let next: Record<string, VizExploreConfig>;
        if (configsEqual(config, baseline)) {
          if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
          const { [id]: _, ...rest } = prev;
          next = rest;
        } else {
          next = { ...prev, [id]: config };
        }
        draftsRef.current = next;
        return next;
      });
    },
    [],
  );

  const discardDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const { [id]: _, ...rest } = prev;
      draftsRef.current = rest;
      return rest;
    });
  }, []);

  const saveDraft = useCallback(
    (
      workspaceId: string,
      viz: Visualization,
      config: VizExploreConfig,
    ): Visualization | null => {
      const updated: Visualization =
        config.chartKind === "table"
          ? {
              ...viz,
              updatedAt: new Date().toISOString(),
            }
          : (() => {
              const dataset = flattenVisualization(viz);
              const data = rebuildChartData(dataset.rows, config);
              return {
                ...viz,
                kind: config.chartKind,
                data,
                updatedAt: new Date().toISOString(),
              };
            })();
      saveVisualizationEdits(workspaceId, updated, config);
      setDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, viz.id)) return prev;
        const { [viz.id]: _, ...rest } = prev;
        draftsRef.current = rest;
        return rest;
      });
      window.dispatchEvent(new Event("visualizations-changed"));
      return updated;
    },
    [],
  );

  const confirmDiscardIfDirty = useCallback(
    (id: string | null | undefined) => {
      if (!id || !Object.prototype.hasOwnProperty.call(draftsRef.current, id)) {
        return true;
      }
      const ok = window.confirm(LEAVE_MESSAGE);
      if (ok) {
        const { [id]: _, ...rest } = draftsRef.current;
        draftsRef.current = rest;
        setDrafts(rest);
        bypassUntilRef.current = Date.now() + 1000;
      }
      return ok;
    },
    [],
  );

  useEffect(() => {
    function confirmLeave(): boolean {
      if (Date.now() < bypassUntilRef.current) return true;
      if (Object.keys(draftsRef.current).length === 0) return true;
      const ok = window.confirm(LEAVE_MESSAGE);
      if (ok) discardAllSync();
      return ok;
    }

    setNavigationGuard((_nextUrl) => confirmLeave());
    const uninstall = installNavigationGuards();

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (Object.keys(draftsRef.current).length === 0) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      setNavigationGuard(null);
      uninstall();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [discardAllSync]);

  const value = useMemo<VisualizationDraftContextValue>(
    () => ({
      isDirty,
      dirtyCount,
      getDraft,
      setDraft,
      discardDraft,
      saveDraft,
      confirmDiscardIfDirty,
    }),
    [
      isDirty,
      dirtyCount,
      getDraft,
      setDraft,
      discardDraft,
      saveDraft,
      confirmDiscardIfDirty,
    ],
  );

  return (
    <VisualizationDraftContext.Provider value={value}>
      {children}
    </VisualizationDraftContext.Provider>
  );
}

export function useVisualizationDraft() {
  const ctx = useContext(VisualizationDraftContext);
  if (!ctx) {
    throw new Error(
      "useVisualizationDraft must be used within VisualizationDraftProvider",
    );
  }
  return ctx;
}

export function useVisualizationDraftOptional() {
  return useContext(VisualizationDraftContext);
}
