export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function createProductId(): string {
  return `prod_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
