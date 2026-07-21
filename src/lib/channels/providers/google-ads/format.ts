/** Client-safe Google Ads ID helpers (no env / secrets). */

export function normalizeCustomerId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{6,12}$/.test(digits)) {
    throw new Error("Enter a valid Google Ads customer ID.");
  }
  return digits;
}

export function formatCustomerId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
