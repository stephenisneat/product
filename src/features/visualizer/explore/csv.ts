import type { VizField, VizRow } from "@/features/visualizer/explore/types";

function escapeCsvCell(value: string | number | null): string {
  if (value == null) return "";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function rowsToCsv(fields: VizField[], rows: VizRow[]): string {
  const header = fields.map((field) => escapeCsvCell(field.label)).join(",");
  const body = rows.map((row) =>
    fields.map((field) => escapeCsvCell(row[field.key] ?? null)).join(","),
  );
  return [header, ...body].join("\n");
}

function slugifyFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "visualization";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugifyFilename(filename)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
