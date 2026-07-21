"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Visualization } from "@/domain";
import { flattenVisualization } from "@/features/visualizer/explore/flatten";
import { rebuildChartData } from "@/features/visualizer/explore/transform";
import type { VizExploreConfig } from "@/features/visualizer/explore/types";
import { saveVisualizationEdits } from "@/features/visualizer/visualization-store";

export function configsEqual(a: VizExploreConfig, b: VizExploreConfig) {
  return JSON.stringify(a) === JSON.stringify(b);
}

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

  const isDirty = useCallback(
    (id: string) => Object.prototype.hasOwnProperty.call(drafts, id),
    [drafts],
  );

  const dirtyCount = useMemo(() => Object.keys(drafts).length, [drafts]);

  const getDraft = useCallback((id: string) => drafts[id], [drafts]);

  const setDraft = useCallback(
    (id: string, config: VizExploreConfig, baseline: VizExploreConfig) => {
      setDrafts((prev) => {
        if (configsEqual(config, baseline)) {
          if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: config };
      });
    },
    [],
  );

  const discardDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const saveDraft = useCallback(
    (
      workspaceId: string,
      viz: Visualization,
      config: VizExploreConfig,
    ): Visualization | null => {
      const dataset = flattenVisualization(viz);
      const data = rebuildChartData(dataset.rows, config);
      const updated: Visualization = {
        ...viz,
        kind: config.chartKind,
        data,
        updatedAt: new Date().toISOString(),
      };
      saveVisualizationEdits(workspaceId, updated, config);
      setDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, viz.id)) return prev;
        const { [viz.id]: _, ...rest } = prev;
        return rest;
      });
      window.dispatchEvent(new Event("visualizations-changed"));
      return updated;
    },
    [],
  );

  const confirmDiscardIfDirty = useCallback(
    (id: string | null | undefined) => {
      if (!id || !Object.prototype.hasOwnProperty.call(drafts, id)) return true;
      const ok = window.confirm(
        "You have unsaved changes. Leave without saving?",
      );
      if (ok) {
        setDrafts((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      }
      return ok;
    },
    [drafts],
  );

  useEffect(() => {
    if (dirtyCount === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyCount]);

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
