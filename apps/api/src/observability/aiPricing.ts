/**
 * Centralised AI model pricing. Every AI cost figure in analytics comes from
 * here — no handler hardcodes prices. Values are USD per 1,000,000 tokens and
 * are OPERATOR-MAINTAINED ESTIMATES: verify against the provider's pricing page
 * before relying on them for finance. When a model is not in the table we emit
 * `costUsd: null` and `estimated: false` rather than guessing.
 *
 * Match is by case-insensitive substring on the model id so `openai/gpt-4o-mini`
 * and `gpt-4o-mini` both resolve. First matching row wins — order longest /
 * most-specific keys first.
 */

export type ModelPrice = {
  /** USD per 1M input tokens. */
  inputPerMillion: number;
  /** USD per 1M output tokens. */
  outputPerMillion: number;
};

// Ordered: more specific keys first.
export const MODEL_PRICING: ReadonlyArray<readonly [string, ModelPrice]> = [
  ['gpt-4o-mini', { inputPerMillion: 0.15, outputPerMillion: 0.60 }],
  ['gemini-3.1-flash-lite', { inputPerMillion: 0.10, outputPerMillion: 0.40 }],
  ['gemini-3.5-flash', { inputPerMillion: 0.30, outputPerMillion: 2.50 }],
  ['claude-fable-5', { inputPerMillion: 1.00, outputPerMillion: 5.00 }],
  // Known free tiers — real zero, not "unknown".
  ['nemotron', { inputPerMillion: 0, outputPerMillion: 0 }],
  [':free', { inputPerMillion: 0, outputPerMillion: 0 }],
];

export type CostEstimate = {
  costUsd: number | null;
  /** true when costUsd was computed from the pricing table; false when we could not price it. */
  estimated: boolean;
  matchedModelKey: string | null;
};

export function findModelPrice(model: string | undefined): readonly [string, ModelPrice] | null {
  if (!model) return null;
  const lower = model.toLowerCase();
  for (const row of MODEL_PRICING) {
    if (lower.includes(row[0])) return row;
  }
  return null;
}

export function estimateCostUsd(
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): CostEstimate {
  const match = findModelPrice(model);
  if (!match || typeof inputTokens !== 'number' || typeof outputTokens !== 'number') {
    return { costUsd: null, estimated: false, matchedModelKey: match?.[0] ?? null };
  }
  const [key, price] = match;
  const cost =
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion;
  return { costUsd: Math.round(cost * 1_000_000) / 1_000_000, estimated: true, matchedModelKey: key };
}
