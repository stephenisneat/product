/** Markup applied on top of raw provider cost when billing the wallet. */
export const AI_MARKUP = 1.5;

/** USD per 1M tokens. Adjust when models change. */
export const MODEL_PRICING_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

const DEFAULT_PRICING = MODEL_PRICING_PER_MILLION["gpt-4.1-mini"];

export function getModelPricing(model: string) {
  return MODEL_PRICING_PER_MILLION[model] ?? DEFAULT_PRICING;
}

/** Raw provider cost in USD (not cents). */
export function providerCostUsd(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const pricing = getModelPricing(input.model);
  const inputCost = (input.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (input.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/** Billed amount in integer cents after markup. Minimum 1 cent if there was any usage. */
export function billedCostCents(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  markup?: number;
}): number {
  const tokens = input.inputTokens + input.outputTokens;
  if (tokens <= 0) return 0;
  const usd = providerCostUsd(input) * (input.markup ?? AI_MARKUP);
  const cents = Math.ceil(usd * 100);
  return Math.max(1, cents);
}

export const CREDIT_MIN_CENTS = 500; // $5
export const CREDIT_MAX_CENTS = 20_000_000; // $200,000
