"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Visualization } from "@/domain";
import {
  createVisualization,
  VISUALIZATION_TEMPLATES,
  type VisualizationTemplate,
} from "@/features/visualizer/dummy-data";
import {
  listRecents,
  openVisualizationTab,
  upsertVisualization,
} from "@/features/visualizer/visualization-store";

const kindLabel: Record<string, string> = {
  sankey: "Sankey",
  timeseries: "Timeseries",
  comparison: "Comparison",
  bar: "Bar",
};

export function NewVisualizationScreen({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const router = useRouter();
  // SSR-safe default; localStorage is read after mount to avoid hydration mismatch.
  const [recents, setRecents] = useState<Visualization[]>([]);

  useEffect(() => {
    function refresh() {
      setRecents(listRecents(workspaceId));
    }
    refresh();
    window.addEventListener("visualizations-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("visualizations-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceId]);

  function openViz(viz: Visualization) {
    upsertVisualization(workspaceId, viz);
    openVisualizationTab(workspaceId, viz.id);
    window.dispatchEvent(new Event("visualizations-changed"));
    router.push(`/visualizer/${viz.id}`);
  }

  function openTemplate(template: VisualizationTemplate) {
    const viz = createVisualization({
      title: template.title,
      kind: template.kind,
      periodA: template.periodA,
      periodB: template.periodB,
      prompt: `Template: ${template.title}`,
    });
    openViz(viz);
  }

  function openRecent(viz: Visualization) {
    openVisualizationTab(workspaceId, viz.id);
    window.dispatchEvent(new Event("visualizations-changed"));
    router.push(`/visualizer/${viz.id}`);
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-medium tracking-tight">New visualization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a template or reopen a recent chart. You can also ask the agent
          to create one from a question.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Templates
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {VISUALIZATION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => openTemplate(template)}
              className="rounded-lg border border-border bg-background/40 p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{template.title}</span>
                <span className="text-xs text-muted-foreground">
                  {kindLabel[template.kind]}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Recents
        </h2>
        {recents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent visualizations yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recents.map((viz) => (
              <li key={viz.id}>
                <button
                  type="button"
                  onClick={() => openRecent(viz)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40"
                >
                  <span className="min-w-0 truncate font-medium">
                    {viz.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {kindLabel[viz.kind]} ·{" "}
                    {new Date(viz.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}
