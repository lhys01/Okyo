/**
 * Epicure — additive ingredient-intelligence layer.
 *
 * Sits BETWEEN dish analysis and recipe generation in the scan pipeline:
 *
 *   image → dish analysis → ingredient extraction → [Epicure enrichment] → recipe → display
 *
 * Given the ingredients detected in a dish, Epicure asks a food-intelligence model
 * for (1) ingredients commonly paired with them, (2) healthier swaps, and (3)
 * cheaper swaps. Those suggestions are injected into the recipe prompt so the
 * generated recipe is smarter — without replacing the existing generation system.
 *
 * Hard guarantees (this integration is ADDITIVE):
 *  - When EPICURE_ENABLED is off (or no API key), `enrichRecipeContext` returns
 *    null and the recipe prompt is built exactly as before.
 *  - Every failure (timeout, HTTP error, bad JSON) is swallowed and returns the
 *    empty/neutral result. Epicure can NEVER break or block recipe generation.
 */

import type { RecipeMode } from '../types.js';
import {
  getOpenRouterConfig,
  isEpicureEnabled,
  type OpenRouterConfig,
} from '../config/openRouter.js';
import { logEpicureUsage } from './epicureAnalytics.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

// Keep the request bounded so a slow free-tier model can't balloon the prompt
// or the cost. Trim noisy/duplicate ingredient names before sending.
const MAX_INGREDIENTS = 12;
const MAX_SUGGESTIONS = 8;
const MAX_EPICURE_OUTPUT_TOKENS = 512;

export type EpicureSuggestions = {
  complementaryIngredients: string[];
  healthySubstitutions: Record<string, string>;
  budgetSubstitutions: Record<string, string>;
};

export type EnrichRecipeContextInput = {
  dishName: string;
  ingredients: string[];
  mode: RecipeMode;
};

export type EnrichedRecipeContext = {
  detectedIngredients: string[];
  complementaryIngredients: string[];
  healthySubstitutions: Record<string, string>;
  budgetSubstitutions: Record<string, string>;
};

const EMPTY_SUGGESTIONS: EpicureSuggestions = {
  complementaryIngredients: [],
  healthySubstitutions: {},
  budgetSubstitutions: {},
};

/**
 * Queries the food-intelligence model for ingredient relationships.
 *
 * Always resolves (never throws): on a missing key, a disabled flag, an empty
 * ingredient list, or any provider failure it returns EMPTY_SUGGESTIONS so callers
 * can treat "no help" and "help" uniformly.
 */
export async function getEpicureSuggestions(
  ingredients: string[],
  config: OpenRouterConfig = getOpenRouterConfig(),
): Promise<EpicureSuggestions> {
  const cleanIngredients = normalizeIngredientList(ingredients);
  if (!isEpicureEnabled(config)) {
    console.log('[epicure] EPICURE_DISABLED — skipping enrichment (EPICURE_ENABLED=false or no API key)');
    return EMPTY_SUGGESTIONS;
  }
  if (cleanIngredients.length === 0) {
    console.log('[epicure] EPICURE_SKIP — no ingredients to enrich');
    return EMPTY_SUGGESTIONS;
  }

  try {
    const raw = await requestEpicureModel(cleanIngredients, config);
    return normalizeEpicureSuggestions(raw);
  } catch (error) {
    console.warn('[epicure] EPICURE_FAILURE — suggestion request failed, continuing without enrichment', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return EMPTY_SUGGESTIONS;
  }
}

/**
 * Reusable enrichment helper called right before recipe generation.
 *
 * Returns null when enrichment is unavailable (flag off, no key, no suggestions,
 * or failure) so the caller leaves the recipe prompt untouched. Returns a populated
 * context only when Epicure actually produced something useful.
 */
export async function enrichRecipeContext(
  input: EnrichRecipeContextInput,
  config: OpenRouterConfig = getOpenRouterConfig(),
): Promise<EnrichedRecipeContext | null> {
  const detectedIngredients = normalizeIngredientList(input.ingredients);

  if (!isEpicureEnabled(config) || detectedIngredients.length === 0) {
    // Feature flag off / nothing to enrich → behave exactly as before.
    logEpicureUsage({
      epicureUsed: false,
      ingredientCount: detectedIngredients.length,
      suggestionCount: 0,
      generationMode: input.mode,
    });
    return null;
  }

  const suggestions = await getEpicureSuggestions(detectedIngredients, config);
  const suggestionCount = countSuggestions(suggestions);

  logEpicureUsage({
    epicureUsed: suggestionCount > 0,
    ingredientCount: detectedIngredients.length,
    suggestionCount,
    generationMode: input.mode,
  });

  if (suggestionCount === 0) {
    return null;
  }

  return {
    detectedIngredients,
    complementaryIngredients: suggestions.complementaryIngredients,
    healthySubstitutions: suggestions.healthySubstitutions,
    budgetSubstitutions: suggestions.budgetSubstitutions,
  };
}

/**
 * Builds the recipe-prompt section that injects Epicure's suggestions.
 *
 * Pure + deterministic (no I/O) so it is easy to unit test and so the recipe
 * provider can append it without any Epicure-specific knowledge. Returns '' when
 * there is nothing to inject, which keeps the base prompt byte-for-byte unchanged.
 *
 * Mode-specific behavior (requirement 7):
 *  - Restaurant Copy → prioritize complementary ingredients
 *  - Healthy         → prioritize healthy substitutions
 *  - Budget          → prioritize budget substitutions
 */
export function buildEpicurePromptSection(
  enrichment: EnrichedRecipeContext | null,
  mode: RecipeMode,
): string {
  if (!enrichment) {
    return '';
  }

  const complementary = enrichment.complementaryIngredients.join(', ') || 'none';
  const healthy = formatSubstitutionMap(enrichment.healthySubstitutions);
  const budget = formatSubstitutionMap(enrichment.budgetSubstitutions);

  return [
    'INGREDIENT INTELLIGENCE (from Epicure — optional guidance, never required):',
    `Detected ingredients: ${enrichment.detectedIngredients.join(', ') || 'none'}`,
    `Complementary ingredients: ${complementary}`,
    `Healthy substitutions: ${healthy}`,
    `Budget substitutions: ${budget}`,
    'Use these suggestions when helpful, but do not force them. Only apply a suggestion when it fits the actual dish; never change the dish into something else.',
    getModeEmphasis(mode),
  ].join('\n');
}

function getModeEmphasis(mode: RecipeMode): string {
  switch (mode) {
    case 'Healthy':
      return 'For this Healthy recipe, prioritize the healthy substitutions above when they keep the dish recognizable.';
    case 'Budget':
      return 'For this Budget recipe, prioritize the budget substitutions above when they keep the dish recognizable.';
    case 'Restaurant Copy':
    default:
      return 'For this Restaurant Copy recipe, prioritize the complementary ingredients above to round out authentic restaurant-style flavor.';
  }
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

export function normalizeIngredientList(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of ingredients) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_INGREDIENTS) break;
  }
  return result;
}

/**
 * Coerces an arbitrary model response into the strict EpicureSuggestions shape.
 * Tolerant by design: missing/garbage fields collapse to empty rather than throw,
 * so a partially-valid model answer still yields usable enrichment.
 */
export function normalizeEpicureSuggestions(raw: unknown): EpicureSuggestions {
  const record = isRecord(raw) ? raw : {};
  return {
    complementaryIngredients: toStringArray(record.complementaryIngredients).slice(0, MAX_SUGGESTIONS),
    healthySubstitutions: toStringMap(record.healthySubstitutions),
    budgetSubstitutions: toStringMap(record.budgetSubstitutions),
  };
}

export function countSuggestions(suggestions: EpicureSuggestions): number {
  return (
    suggestions.complementaryIngredients.length +
    Object.keys(suggestions.healthySubstitutions).length +
    Object.keys(suggestions.budgetSubstitutions).length
  );
}

function formatSubstitutionMap(map: Record<string, string>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([from, to]) => `${from} → ${to}`).join(', ');
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function toStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  let count = 0;
  for (const [from, to] of Object.entries(value)) {
    if (count >= MAX_SUGGESTIONS) break;
    const fromKey = from.trim();
    const toValue = typeof to === 'string' ? to.trim() : '';
    if (!fromKey || !toValue) continue;
    result[fromKey] = toValue;
    count += 1;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// ─── Network (isolated, never imported by tests) ──────────────────────────────

function buildEpicurePrompt(ingredients: string[]): string {
  return [
    'You are a food-pairing and ingredient-substitution expert.',
    `Given these ingredients: ${ingredients.join(', ')}.`,
    'Suggest:',
    '1. ingredients commonly paired with them (complementaryIngredients)',
    '2. healthier replacements (healthySubstitutions: original → healthier)',
    '3. cheaper replacements (budgetSubstitutions: original → cheaper)',
    'Return STRICT minified JSON with EXACTLY this shape and no extra keys:',
    '{"complementaryIngredients":["..."],"healthySubstitutions":{"original":"healthier"},"budgetSubstitutions":{"original":"cheaper"}}',
    'Use real grocery-store ingredient names. Keep each list short (max 8). Only suggest substitutions that keep the dish recognizable.',
    'Return ONLY the JSON object. No markdown, no commentary, no reasoning.',
  ].join('\n');
}

async function requestEpicureModel(
  ingredients: string[],
  config: OpenRouterConfig,
): Promise<unknown> {
  if (!config.apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing.');
  }

  console.log('[epicure] EPICURE_REQUEST_START', {
    model: config.model,
    ingredientCount: ingredients.length,
    maxTokens: MAX_EPICURE_OUTPUT_TOKENS,
    timeoutMs: config.timeoutMs,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now(); // [scan_timing] epicure pre-call latency

  try {
    const response = await fetch(openRouterEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://okyo.local',
        'X-Title': 'Okyo Epicure',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: MAX_EPICURE_OUTPUT_TOKENS,
        temperature: 0.3,
        reasoning: { enabled: false },
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are Epicure, a food-intelligence assistant. Return ONLY valid JSON. No markdown, no reasoning, no explanation.',
          },
          { role: 'user', content: buildEpicurePrompt(ingredients) },
        ],
      }),
      signal: controller.signal,
    });

    console.log('[epicure] EPICURE_RESPONSE_STATUS', {
      model: config.model,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      console.error('[epicure] EPICURE_HTTP_ERROR', {
        model: config.model,
        status: response.status,
        body: errorBody.slice(0, 300),
      });
      throw new Error(`Epicure HTTP ${response.status}: ${errorBody.slice(0, 120)}`);
    }

    const json = (await response.json()) as unknown;
    const content = extractAssistantContent(json);
    if (!content) {
      console.warn('[epicure] EPICURE_EMPTY_CONTENT', { model: config.model });
      throw new Error('Epicure response had no usable content.');
    }

    const parsed = parseJsonContent(content);
    console.log('[epicure] EPICURE_REQUEST_SUCCESS', {
      model: config.model,
      contentLength: content.length,
      durationMs: Date.now() - startedAt,
    });
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function extractAssistantContent(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined;
  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const message = isRecord(choices[0]) ? choices[0].message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  if (Array.isArray(content)) {
    const text = content
      .map((block) => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    return text || undefined;
  }
  return undefined;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? findFirstJsonObject(trimmed) ?? trimmed;
  return JSON.parse(candidate);
}

function findFirstJsonObject(value: string): string | undefined {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }
  return value.slice(start, end + 1);
}
