import type { VizCell, VizDateRange, VizDateRangePreset, VizRow } from "@/features/visualizer/explore/types";

export const DATE_RANGE_PRESETS: {
  value: VizDateRangePreset;
  label: string;
  group: "trailing" | "calendar" | "all";
}[] = [
  { value: "last_7_days", label: "Last 7 days", group: "trailing" },
  { value: "last_14_days", label: "Last 14 days", group: "trailing" },
  { value: "last_30_days", label: "Last 30 days", group: "trailing" },
  { value: "last_90_days", label: "Last 90 days", group: "trailing" },
  { value: "today", label: "Today", group: "calendar" },
  { value: "yesterday", label: "Yesterday", group: "calendar" },
  { value: "this_week", label: "This week", group: "calendar" },
  { value: "last_week", label: "Last week", group: "calendar" },
  { value: "this_month", label: "This month", group: "calendar" },
  { value: "last_month", label: "Last month", group: "calendar" },
  { value: "this_quarter", label: "This quarter", group: "calendar" },
  { value: "this_year", label: "This year", group: "calendar" },
  { value: "all", label: "All time", group: "all" },
  { value: "custom", label: "Custom", group: "all" },
];

export function dateRangePresetLabel(preset: VizDateRangePreset): string {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

/** Short label for the toolbar badge / button. */
export function dateRangeSummary(range: VizDateRange | null): string | null {
  if (!range || range.preset === "all") return null;
  if (range.preset === "custom") {
    if (range.start && range.end) return `${range.start} → ${range.end}`;
    if (range.start) return `From ${range.start}`;
    if (range.end) return `Until ${range.end}`;
    return "Custom";
  }
  const short: Partial<Record<VizDateRangePreset, string>> = {
    today: "Today",
    yesterday: "Yesterday",
    last_7_days: "7d",
    last_14_days: "14d",
    last_30_days: "30d",
    last_90_days: "90d",
    this_week: "This week",
    last_week: "Last week",
    this_month: "This month",
    last_month: "Last month",
    this_quarter: "This quarter",
    this_year: "This year",
  };
  return short[range.preset] ?? dateRangePresetLabel(range.preset);
}

export function isDateRangeActive(range: VizDateRange | null | undefined): boolean {
  if (!range || range.preset === "all") return false;
  if (range.preset === "custom") {
    return Boolean(range.start || range.end);
  }
  return true;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday-start week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, offset));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateCell(value: VizCell): Date | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveDateRangeBounds(
  range: VizDateRange,
  now = new Date(),
): { start: Date; end: Date } | null {
  if (range.preset === "all") return null;

  const today = startOfDay(now);

  if (range.preset === "custom") {
    const start = range.start ? parseDateCell(range.start) : null;
    const end = range.end ? parseDateCell(range.end) : null;
    if (!start && !end) return null;
    return {
      start: start ? startOfDay(start) : new Date(0),
      end: end ? endOfDay(end) : endOfDay(today),
    };
  }

  switch (range.preset) {
    case "today":
      return { start: today, end: endOfDay(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y) };
    }
    case "last_7_days":
      return { start: addDays(today, -6), end: endOfDay(today) };
    case "last_14_days":
      return { start: addDays(today, -13), end: endOfDay(today) };
    case "last_30_days":
      return { start: addDays(today, -29), end: endOfDay(today) };
    case "last_90_days":
      return { start: addDays(today, -89), end: endOfDay(today) };
    case "this_week": {
      const start = startOfWeek(today);
      return { start, end: endOfDay(today) };
    }
    case "last_week": {
      const thisWeekStart = startOfWeek(today);
      const start = addDays(thisWeekStart, -7);
      return { start, end: endOfDay(addDays(thisWeekStart, -1)) };
    }
    case "this_month":
      return { start: startOfMonth(today), end: endOfDay(today) };
    case "last_month": {
      const start = startOfMonth(addDays(startOfMonth(today), -1));
      const end = endOfDay(addDays(startOfMonth(today), -1));
      return { start, end };
    }
    case "this_quarter":
      return { start: startOfQuarter(today), end: endOfDay(today) };
    case "this_year":
      return { start: startOfYear(today), end: endOfDay(today) };
  }
}

export function applyDateRange(
  rows: VizRow[],
  range: VizDateRange | null | undefined,
  now = new Date(),
): VizRow[] {
  if (!range || !isDateRangeActive(range) || !range.field) return rows;
  const bounds = resolveDateRangeBounds(range, now);
  if (!bounds) return rows;

  return rows.filter((row) => {
    const cell = parseDateCell(row[range.field]);
    if (!cell) return false;
    const t = cell.getTime();
    return t >= bounds.start.getTime() && t <= bounds.end.getTime();
  });
}

export function emptyDateRange(field = "date"): VizDateRange {
  return {
    field,
    preset: "all",
    start: null,
    end: null,
  };
}
