/** Default chat model when the user has no saved preference. */
export const DEFAULT_CHAT_MODEL = "openai/gpt-4.1-mini";

/**
 * Curated popular models shown at the top of the picker.
 * IDs must match AI Gateway language models with tool-use.
 */
export const POPULAR_MODEL_IDS = [
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.4",
  "google/gemini-3-flash",
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.5",
  "xai/grok-4.20-reasoning",
  "deepseek/deepseek-v3.2",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-4.1-mini",
] as const;

export type GatewayModelPricing = {
  /** USD per token */
  input: number;
  /** USD per token */
  output: number;
};

export type GatewayChatModel = {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  contextWindow: number | null;
  maxTokens: number | null;
  tags: string[];
  pricing: GatewayModelPricing | null;
  popular: boolean;
};

type GatewayModelsApiResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    description?: string | null;
    owned_by?: string;
    type?: string;
    context_window?: number;
    max_tokens?: number;
    tags?: string[];
    pricing?: {
      input?: string;
      output?: string;
    };
  }>;
};

const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cache: { at: number; models: GatewayChatModel[] } | null = null;

export function providerFromModelId(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash >= 0 ? modelId.slice(0, slash) : modelId;
}

/** Official provider logos from models.dev (Vercel). */
export function modelLogoUrl(modelIdOrProvider: string): string {
  const provider = modelIdOrProvider.includes("/")
    ? providerFromModelId(modelIdOrProvider)
    : modelIdOrProvider;
  return `https://models.dev/logos/${encodeURIComponent(provider)}.svg`;
}

function parseTokenPrice(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeModel(
  raw: NonNullable<GatewayModelsApiResponse["data"]>[number],
  popularIds: Set<string>,
): GatewayChatModel | null {
  if (!raw.id || raw.type !== "language") return null;
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  if (tags.length > 0 && !tags.includes("tool-use")) return null;

  const input = parseTokenPrice(raw.pricing?.input);
  const output = parseTokenPrice(raw.pricing?.output);

  return {
    id: raw.id,
    name: raw.name?.trim() || raw.id,
    description: raw.description?.trim() || null,
    provider: raw.owned_by?.trim() || providerFromModelId(raw.id),
    contextWindow: raw.context_window ?? null,
    maxTokens: raw.max_tokens ?? null,
    tags,
    pricing:
      input != null && output != null ? { input, output } : null,
    popular: popularIds.has(raw.id),
  };
}

function sortModels(models: GatewayChatModel[]): GatewayChatModel[] {
  const popularRank = new Map<string, number>(
    POPULAR_MODEL_IDS.map((id, index) => [id, index]),
  );
  return [...models].sort((a, b) => {
    const aPop = popularRank.get(a.id);
    const bPop = popularRank.get(b.id);
    if (aPop != null && bPop != null) return aPop - bPop;
    if (aPop != null) return -1;
    if (bPop != null) return 1;
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function fetchGatewayChatModels(options?: {
  force?: boolean;
}): Promise<GatewayChatModel[]> {
  if (
    !options?.force &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.models;
  }

  const res = await fetch(MODELS_URL, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch AI Gateway models (${res.status})`);
  }

  const json = (await res.json()) as GatewayModelsApiResponse;
  const popularIds = new Set<string>(POPULAR_MODEL_IDS);
  const models = sortModels(
    (json.data ?? [])
      .map((row) => normalizeModel(row, popularIds))
      .filter((m): m is GatewayChatModel => m != null),
  );

  cache = { at: Date.now(), models };
  return models;
}

export async function getGatewayChatModel(
  modelId: string,
): Promise<GatewayChatModel | null> {
  const models = await fetchGatewayChatModels();
  return models.find((m) => m.id === modelId) ?? null;
}

/** Prefer a requested model when it exists; otherwise fall back to default. */
export async function resolveChatModel(
  requested: string | null | undefined,
): Promise<{ modelId: string; model: GatewayChatModel | null }> {
  const models = await fetchGatewayChatModels().catch(() => null);
  if (!models || models.length === 0) {
    const fallback = requested?.trim() || DEFAULT_CHAT_MODEL;
    return { modelId: fallback, model: null };
  }

  const wanted = requested?.trim();
  if (wanted) {
    const match = models.find((m) => m.id === wanted);
    if (match) return { modelId: match.id, model: match };
  }

  const def =
    models.find((m) => m.id === DEFAULT_CHAT_MODEL) ?? models[0] ?? null;
  return {
    modelId: def?.id ?? DEFAULT_CHAT_MODEL,
    model: def,
  };
}

export function isValidGatewayModelId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._+-]*$/i.test(value);
}
