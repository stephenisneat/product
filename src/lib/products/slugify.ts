export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function createProductId(): string {
  return shortId("prod");
}

export function createVariantId(): string {
  return shortId("var");
}

export function createOptionId(): string {
  return shortId("opt");
}

export function createCollectionId(): string {
  return shortId("col");
}

export function createConnectionId(): string {
  return shortId("conn");
}
