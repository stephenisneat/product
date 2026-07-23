import type { Visualization } from "@/domain";
import type { VizExploreConfig } from "@/features/visualizer/explore/types";

export type VisualizationStore = {
  visualizations: Visualization[];
  openTabIds: string[];
  /** Last visualizer route visited (`/visualizer` or `/visualizer/[id]`). */
  lastPath: string;
  seeded: boolean;
  /** Saved explore configs keyed by visualization id. Only written on explicit Save. */
  explores: Record<string, VizExploreConfig>;
};

const DEFAULT_VISUALIZER_PATH = "/visualizer";

function storageKey(workspaceId: string) {
  return `visualizations:${workspaceId}`;
}

function emptyStore(): VisualizationStore {
  return {
    visualizations: [],
    openTabIds: [],
    lastPath: DEFAULT_VISUALIZER_PATH,
    seeded: false,
    explores: {},
  };
}

function normalizeLastPath(
  path: string | undefined,
  visualizations: Visualization[],
  openTabIds: string[],
): string {
  if (path === DEFAULT_VISUALIZER_PATH || path === "/visualizer/") {
    return DEFAULT_VISUALIZER_PATH;
  }
  const match = path?.match(/^\/visualizer\/([^/]+)$/);
  if (match) {
    const id = match[1]!;
    if (visualizations.some((v) => v.id === id)) {
      return `/visualizer/${id}`;
    }
  }
  const lastOpen = openTabIds[openTabIds.length - 1];
  if (lastOpen && visualizations.some((v) => v.id === lastOpen)) {
    return `/visualizer/${lastOpen}`;
  }
  return DEFAULT_VISUALIZER_PATH;
}

export function loadVisualizationStore(
  workspaceId: string,
): VisualizationStore {
  if (typeof window === "undefined") {
    return emptyStore();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) {
      const store = emptyStore();
      saveVisualizationStore(workspaceId, store);
      return store;
    }

    const parsed = JSON.parse(raw) as VisualizationStore;
    if (!parsed || !Array.isArray(parsed.visualizations)) {
      const store = emptyStore();
      saveVisualizationStore(workspaceId, store);
      return store;
    }

    const openTabIds = Array.isArray(parsed.openTabIds)
      ? parsed.openTabIds.filter((id) =>
          parsed.visualizations.some((v) => v.id === id),
        )
      : [];

    const explores =
      parsed.explores && typeof parsed.explores === "object"
        ? Object.fromEntries(
            Object.entries(parsed.explores).filter(([id]) =>
              parsed.visualizations.some((v) => v.id === id),
            ),
          )
        : {};

    return {
      visualizations: parsed.visualizations,
      openTabIds,
      lastPath: normalizeLastPath(
        parsed.lastPath,
        parsed.visualizations,
        openTabIds,
      ),
      seeded: parsed.seeded === true,
      explores,
    };
  } catch {
    const store = emptyStore();
    saveVisualizationStore(workspaceId, store);
    return store;
  }
}

export function saveVisualizationStore(
  workspaceId: string,
  store: VisualizationStore,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(store));
}

export function listVisualizations(workspaceId: string): Visualization[] {
  return loadVisualizationStore(workspaceId).visualizations;
}

export function listRecents(
  workspaceId: string,
  limit = 8,
): Visualization[] {
  return [...listVisualizations(workspaceId)]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

export function getVisualization(
  workspaceId: string,
  id: string,
): Visualization | null {
  return (
    loadVisualizationStore(workspaceId).visualizations.find((v) => v.id === id) ??
    null
  );
}

export function upsertVisualization(
  workspaceId: string,
  visualization: Visualization,
): VisualizationStore {
  const store = loadVisualizationStore(workspaceId);
  const idx = store.visualizations.findIndex((v) => v.id === visualization.id);
  const visualizations =
    idx === -1
      ? [visualization, ...store.visualizations]
      : store.visualizations.map((v, i) =>
          i === idx ? visualization : v,
        );
  const next = { ...store, visualizations, seeded: true };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function getVisualizationExplore(
  workspaceId: string,
  id: string,
): VizExploreConfig | null {
  const explore = loadVisualizationStore(workspaceId).explores[id];
  if (!explore) return null;
  return {
    ...explore,
    dateRange: explore.dateRange ?? null,
  };
}

export function saveVisualizationEdits(
  workspaceId: string,
  visualization: Visualization,
  explore: VizExploreConfig,
): VisualizationStore {
  const store = upsertVisualization(workspaceId, visualization);
  const next: VisualizationStore = {
    ...store,
    explores: {
      ...store.explores,
      [visualization.id]: explore,
    },
  };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function deleteVisualization(workspaceId: string, id: string) {
  const store = loadVisualizationStore(workspaceId);
  const visualizations = store.visualizations.filter((v) => v.id !== id);
  const openTabIds = store.openTabIds.filter((tabId) => tabId !== id);
  const { [id]: _removed, ...explores } = store.explores;
  const next: VisualizationStore = {
    ...store,
    visualizations,
    openTabIds,
    explores,
    lastPath: normalizeLastPath(store.lastPath, visualizations, openTabIds),
  };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function getLastVisualizerPath(workspaceId: string): string {
  return loadVisualizationStore(workspaceId).lastPath;
}

export function setLastVisualizerPath(
  workspaceId: string,
  path: string,
): VisualizationStore {
  const store = loadVisualizationStore(workspaceId);
  const lastPath = normalizeLastPath(
    path,
    store.visualizations,
    store.openTabIds,
  );
  if (store.lastPath === lastPath) return store;
  const next = { ...store, lastPath };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function getOpenTabIds(workspaceId: string): string[] {
  return loadVisualizationStore(workspaceId).openTabIds;
}

export function openVisualizationTab(
  workspaceId: string,
  id: string,
): VisualizationStore {
  const store = loadVisualizationStore(workspaceId);
  const openTabIds = store.openTabIds.includes(id)
    ? store.openTabIds
    : [...store.openTabIds, id];
  const next = { ...store, openTabIds };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function closeVisualizationTab(
  workspaceId: string,
  id: string,
): VisualizationStore {
  const store = loadVisualizationStore(workspaceId);
  const openTabIds = store.openTabIds.filter((tabId) => tabId !== id);
  const next: VisualizationStore = {
    ...store,
    openTabIds,
    lastPath: normalizeLastPath(store.lastPath, store.visualizations, openTabIds),
  };
  saveVisualizationStore(workspaceId, next);
  return next;
}

export function reorderVisualizationTabs(
  workspaceId: string,
  orderedIds: string[],
): VisualizationStore {
  const store = loadVisualizationStore(workspaceId);
  const allowed = new Set(store.openTabIds);
  const openTabIds = orderedIds.filter((id) => allowed.has(id));
  for (const id of store.openTabIds) {
    if (!openTabIds.includes(id)) openTabIds.push(id);
  }
  if (
    openTabIds.length === store.openTabIds.length &&
    openTabIds.every((id, i) => id === store.openTabIds[i])
  ) {
    return store;
  }
  const next = { ...store, openTabIds };
  saveVisualizationStore(workspaceId, next);
  return next;
}
