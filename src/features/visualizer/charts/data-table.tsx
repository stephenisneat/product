"use client";

import type { VizDataset, VizRow } from "@/features/visualizer/explore/types";

export function VisualizationDataTable({
  dataset,
  rows,
}: {
  dataset: VizDataset;
  rows: VizRow[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-border">
              {dataset.fields.map((field) => (
                <th
                  key={field.key}
                  className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground"
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(dataset.fields.length, 1)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                >
                  {dataset.fields.map((field) => (
                    <td
                      key={field.key}
                      className="max-w-[240px] truncate px-3 py-1.5 tabular-nums text-foreground/90"
                      title={row[field.key] == null ? undefined : String(row[field.key])}
                    >
                      {row[field.key] == null ? "—" : String(row[field.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
