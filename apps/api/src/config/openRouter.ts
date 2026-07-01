/**
 * OpenRouter configuration for the Epicure ingredient-intelligence layer.
 *
 * This is intentionally SEPARATE from `aiConfig.ts`:
 *  - `aiConfig.ts` owns the vision + recipe generation models (OPENROUTER_VISION_MODEL
 *    / OPENROUTER_TEXT_MODEL) used by the existing scan → recipe pipeline.
 *  - This file owns the single food-intelligence model (OPENROUTER_MODEL) used by
 *    the additive Epicure enrichment service, plus the EPICURE_ENABLED feature flag.
 *
 * Models must never be hardcoded elsewhere — read them from here.
 */

// Default food-intelligence model for Epicure.
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

// How long an Epicure suggestion request may run before we give up and fall back
// to plain recipe generation. Kept short — enrichment is a "nice to have" that must
// never noticeably slow down (or block) the recipe the user actually waits for.
const DEFAULT_EPICURE_TIMEOUT_MS = 12_000;

export type OpenRouterConfig = {
  apiKey?: string;
  model: string;
  epicureEnabled: boolean;
  timeoutMs: number;
};

export function getOpenRouterConfig(): OpenRouterConfig {
  return {
    apiKey: getOptionalSecret(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    epicureEnabled: process.env.EPICURE_ENABLED === 'true',
    timeoutMs: getPositiveInteger(process.env.EPICURE_TIMEOUT_MS, DEFAULT_EPICURE_TIMEOUT_MS),
  };
}

// True only when the feature flag is on AND a key is present. When false the
// enrichment layer is a no-op and recipe generation behaves exactly as before.
export function isEpicureEnabled(config: OpenRouterConfig = getOpenRouterConfig()): boolean {
  return config.epicureEnabled && Boolean(config.apiKey);
}

/**
 * Startup validation + warnings. Best-effort and non-fatal: a misconfigured
 * Epicure layer must never stop the API from booting — it simply stays off.
 * Call once at server startup.
 */
export function validateEpicureConfigAtStartup(config: OpenRouterConfig = getOpenRouterConfig()): void {
  if (!config.epicureEnabled) {
    console.log('[epicure] EPICURE_ENABLED is not "true" — ingredient enrichment is OFF. Recipe generation runs unchanged.');
    return;
  }

  if (!config.apiKey) {
    console.warn('[epicure] EPICURE_ENABLED=true but OPENROUTER_API_KEY is missing — enrichment will be skipped. Set OPENROUTER_API_KEY in apps/api/.env to enable it.');
    return;
  }

  console.log(`[epicure] Ingredient enrichment is ON (model: ${config.model}).`);
}

function getOptionalSecret(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
