import { formatMoney } from "@/lib/format";

export function formatCents(cents: number, currency = "USD"): string {
  return formatMoney(cents / 100, currency);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function parseDollarsInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
