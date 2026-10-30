export const APPROVED_OPENROUTER_MODELS = [
  'openai/gpt-4o-mini',
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.5-flash',
  'anthropic/claude-fable-5',
] as const;

const approvedModels = new Set<string>(APPROVED_OPENROUTER_MODELS);

export function isApprovedOpenRouterModel(model: unknown): model is string {
  return typeof model === 'string' && approvedModels.has(model);
}

/** Invalid deployment values safely fall back to the approved default. */
export function selectApprovedOpenRouterModel(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  return candidate && isApprovedOpenRouterModel(candidate) ? candidate : fallback;
}

/** This header selects one named server feature; it never accepts a model ID. */
export function isFableModelOptIn(value: string | undefined): boolean {
  return value === 'fable';
}
