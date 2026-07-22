import type { CommerceProvider } from "@/domain";
import { commerceProviderSchema } from "@/domain";
import type { CommerceConnection } from "@/domain";

/**
 * Prefer an active commerce connection; otherwise the most common
 * `source_provider` among imported products.
 */
export function detectInstallPlatform(input: {
  connections: CommerceConnection[];
  productProviders: Array<string | null | undefined>;
}): CommerceProvider | null {
  const active = input.connections.find((c) => c.status === "active");
  if (active) return active.provider;

  const anyConnection = input.connections[0];
  if (anyConnection) return anyConnection.provider;

  const counts = new Map<CommerceProvider, number>();
  for (const raw of input.productProviders) {
    const parsed = commerceProviderSchema.safeParse(raw);
    if (!parsed.success) continue;
    counts.set(parsed.data, (counts.get(parsed.data) ?? 0) + 1);
  }

  let best: CommerceProvider | null = null;
  let bestCount = 0;
  for (const [provider, count] of counts) {
    if (count > bestCount) {
      best = provider;
      bestCount = count;
    }
  }
  return best;
}
