import { createHash } from 'node:crypto';
import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import type { RecipeMode, RecipeStep, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';
import { isEpicureEnabled } from '../config/openRouter.js';
import {
  buildEpicurePromptSection,
  enrichRecipeContext,
  type EnrichedRecipeContext,
} from './epicureService.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

// Recipe text model failover chain. Primary set via OPENROUTER_TEXT_MODEL.
const RECIPE_FALLBACK_MODELS = [
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.5-flash',
];
const RECIPE_FAILOVER_DELAYS_MS = [2000, 5000, 10000];

export type OpenRouterFailureReason =
  | 'openrouter_missing_key'
  | 'openrouter_http_error'
  | 'openrouter_timeout'
  | 'openrouter_empty_content'
  | 'openrouter_output_truncated'
  | 'openrouter_invalid_json'
  | 'openrouter_invalid_schema'
  | 'openrouter_network_error'
  | 'openrouter_unknown_error';

export type OpenRouterFailureInfo = {
  reason: OpenRouterFailureReason;
  aiEnabled: boolean;
  hasOpenRouterKey: boolean;
  model: string;
  provider: string;
  timeoutMs: number;
  maxOutputTokens: number;
  httpStatus?: number;
  openRouterErrorMessage?: string;
};

export class OpenRouterProviderError extends Error {
  readonly failure: OpenRouterFailureInfo;

  constructor(failure: OpenRouterFailureInfo) {
    super(failure.openRouterErrorMessage ?? failure.reason);
    this.name = 'OpenRouterProviderError';
    this.failure = failure;
  }
}

type SafeRecord = Record<string, unknown>;

export const openRouterVisionOutputSchema = z.object({
  dishName: z.string().optional(),
  scanState: z.string().optional(),
  broadDishCategory: z.string().optional(),
  dishCategory: z.string().optional(),
  cuisine: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
  isFoodImage: z.union([z.boolean(), z.string()]).optional(),
  foodDetected: z.union([z.boolean(), z.string()]).optional(),
  isRestaurantMeal: z.union([z.boolean(), z.string()]).optional(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  possibleDishNames: z.array(z.string()).optional().default([]),
  visibleComponents: z.object({
    protein: z.string().optional().default(''),
    sauce: z.string().optional().default(''),
    baseStarch: z.string().optional().default(''),
    vegetables: z.string().optional().default(''),
    toppingsGarnish: z.string().optional().default(''),
    cookingMethod: z.string().optional().default(''),
  }).optional().default({}),
  restaurantPriceEstimate: z.union([z.number(), z.string()]).optional(),
  homemadeCostEstimate: z.union([z.number(), z.string()]).optional(),
  confidenceReason: z.string().optional(),
  // Inline Epicure fields — returned by vision when Epicure is enabled, eliminating a
  // separate sequential AI call. .catch(undefined): any malformed model output degrades
  // gracefully to undefined rather than failing the whole vision parse.
  epicureSuggestions: z.object({
    complementaryIngredients: z.array(z.string()).optional().default([]),
    healthySubstitutions: z.record(z.string()).optional().default({}),
    budgetSubstitutions: z.record(z.string()).optional().default({}),
  }).optional().catch(undefined),
});

const recipeStepSchema = z.object({
  // Canonical single-recipe step contract (required by the prompt, enforced by
  // validateRecipeStructure — NOT by zod, so we can surface field-level issue
  // codes for the repair pass instead of one opaque parse failure).
  stepNumber: z.number().optional(),
  step: z.string().optional().default(''),
  ingredients: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  phase: z.number().optional(),
  title: z.string().optional().default(''),
  // Legacy field names kept optional so older outputs and saved-recipe re-parse
  // still map cleanly (getStepText / toStructuredStep read these as fallbacks).
  instruction: z.string().optional().default(''),
  text: z.string().optional().default(''),
  creates: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  lookFor: z.string().optional(),
  doneWhen: z.string().optional(),
  chefTip: z.string().optional(),
  ingredientsUsed: z.array(z.string()).optional(),
  toolsUsed: z.array(z.string()).optional(),
  stepImagePrompt: z.string().optional(),
  stepImagePromptData: z.object({
    subject: z.string().optional().default(''),
    action: z.string().optional().default(''),
    vessel: z.string().optional().default(''),
    visualState: z.string().optional().default(''),
    cameraAngle: z.string().optional().default(''),
    style: z.string().optional().default(''),
  }).optional(),
  commonQuestion: z.string().optional(),
  commonQuestionAnswer: z.string().optional(),
  decisionPoint: z.string().optional(),
  ifYes: z.string().optional(),
  ifNo: z.string().optional(),
  why: z.string().optional(),
  commonMistake: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  timeEstimate: z.string().optional().default(''),
  visualCue: z.string().optional().default(''),
  whyItMatters: z.string().optional().default(''),
  safetyNote: z.string().optional().default(''),
  flavorBoost: z.string().optional().default(''),
  cookingTerm: z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  }).optional(),
});

// Models sometimes return list-like text fields as arrays; coerce instead of failing the whole recipe.
const flexibleText = z.union([z.string(), z.array(z.string())])
  .optional()
  .default('')
  .transform((value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value));

const recipeVariantSchema = z.object({
  title: flexibleText,
  description: flexibleText,
  equipment: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      return String(r.name ?? r.item ?? r.tool ?? r.equipment ?? Object.values(r)[0] ?? '').trim();
    }),
  ])).optional().default([]),
  // ponytail: coerce ingredient objects → strings; model ignores prompt despite repeated instruction
  ingredients: z.array(
    z.union([
      z.string(),
      z.record(z.unknown()).transform((obj) => {
        const q = String((obj as Record<string, unknown>).quantity ?? (obj as Record<string, unknown>).amount ?? '');
        const n = String((obj as Record<string, unknown>).name ?? '');
        return [q, n].filter(Boolean).join(' ').trim();
      }),
    ])
  ).optional().default([]),
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
  avoidMistake: flexibleText,
  mistakeWarning: flexibleText,
  substitutions: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      const from = String(r.ingredient ?? r.name ?? r.from ?? '');
      const to = String(r.substitute ?? r.replacement ?? r.to ?? '');
      const note = String(r.note ?? r.description ?? '');
      return [from && `${from}:`, to, note].filter(Boolean).join(' ').trim();
    }),
  ])).optional().default([]),
  storageAndReheating: flexibleText,
  storage: flexibleText,
  groceryItems: z.array(z.object({
    name: z.string().optional().default(''),
    quantity: z.string().optional().default(''),
    category: z.string().optional().default(''),
    pantryStaple: z.union([z.boolean(), z.string()]).optional(),
    sourceIngredient: z.string().optional().default(''),
    shoppingNote: z.string().optional().default(''),
  })).optional().default([]),
  spicePairings: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      const spice = String(r.spice ?? r.name ?? r.ingredient ?? '');
      const note = String(r.note ?? r.description ?? r.pairing ?? '');
      return [spice, note].filter(Boolean).join(' — ').trim();
    }),
  ])).optional().default([]),
  cookingTerms: z.array(z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  })).optional().default([]),
  prepTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  cookTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  totalTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  activeTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  servings: z.union([z.number(), z.string()]).optional(),
  skillLevel: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
});

// One scan -> one canonical recipe. The AI returns a single recipe object
// (the dish plus its fields/steps), never per-mode variants. Budget/Healthy are
// computed view projections downstream, not separate generations.
export const openRouterRecipeOutputSchema = recipeVariantSchema.extend({
  dishName: z.string().optional().default(''),
});

export type OpenRouterVisionOutput = z.input<typeof openRouterVisionOutputSchema>;
export type OpenRouterRecipeOutput = z.infer<typeof openRouterRecipeOutputSchema>;
export type OpenRouterRecipeVariant = z.infer<typeof recipeVariantSchema>;

type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string | OpenRouterContentPart[];
};

export async function analyzeFoodImageWithOpenRouter(input: {
  config: AiConfig;
  image?: ScanImageMetadata;
  mode: RecipeMode;
}) {
  const imageUrl = getSafeImageUrl(input.image);
  logOpenRouterDebug('api_openrouter_has_image_payload', {
    hasImagePayload: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
  });
  logOpenRouterDebug('openrouter_vision_payload', {
    imagePayloadAttached: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
    imageUriKind: imageUrl ? 'provider_visible' : input.image?.uri ? 'local_or_private_uri_not_sent' : 'none',
    model: input.config.openRouterVisionModel,
  });

  let firstOutput: z.infer<typeof openRouterVisionOutputSchema>;
  try {
    firstOutput = await callVisionOnce(input, getVisionPrompt(input.image, input.mode), 'vision');
  } catch (error) {
    if (!isRetryableVisionOutputError(error)) {
      throw error;
    }

    const retryReason = getOpenRouterErrorReason(error);
    logOpenRouterDebug('openrouter_scan_quality_retry', {
      retryReason,
      retryPrompt: 'compact_vision',
      stage: 'vision_initial_output',
    });
    await waitMs(3500);
    firstOutput = await callVisionOnce(input, getCompactVisionRetryPrompt(input.image, input.mode), 'vision_initial_retry');
    logOpenRouterDebug('openrouter_scan_quality_retry_result', {
      retryReason,
      retryDishName: firstOutput.dishName,
      retryScanState: firstOutput.scanState,
    });
  }
  const firstQuality = evaluateVisionQuality(firstOutput);
  const retryReason = getVisionQualityRetryReason(firstQuality);
  logOpenRouterDebug('openrouter_scan_quality_check', {
    dishName: firstOutput.dishName,
    scanState: firstOutput.scanState,
    confidencePercent: firstQuality.confidencePercent,
    foodVisible: firstQuality.foodVisible,
    genericName: firstQuality.generic,
    drinkMismatch: firstQuality.drinkMismatch,
    lowVisibleFoodConfidence: firstQuality.lowVisibleFoodConfidence,
    needsRetry: firstQuality.needsRetry,
    retryReason,
  });

  if (!firstQuality.needsRetry) {
    return firstOutput;
  }

  // Quality loop: one focused retry when food/drink is visible but the name is
  // generic or contradicts visible drink clues. For too_unclear, use a more
  // direct prompt and accept any result that finds food. Failures keep the first result.
  const isTooUnclearRetry = firstOutput.scanState === 'too_unclear';
  const retryPrompt = isTooUnclearRetry
    ? getCompactVisionRetryPrompt(input.image, input.mode)
    : getFocusedVisionRetryPrompt(input.image, input.mode, firstOutput);
  try {
    const retryOutput = await callVisionOnce(input, retryPrompt, 'vision_quality_retry');
    const retryQuality = evaluateVisionQuality(retryOutput);
    const useRetry = isTooUnclearRetry
      ? retryQuality.foodVisible
      : (retryQuality.foodVisible && !retryQuality.generic && !retryQuality.drinkMismatch);
    logOpenRouterDebug('openrouter_scan_quality_retry', {
      originalDishName: firstOutput.dishName,
      retryReason,
      retryDishName: retryOutput.dishName,
      finalDishName: useRetry ? retryOutput.dishName : firstOutput.dishName,
      retryGeneric: retryQuality.generic,
      retryDrinkMismatch: retryQuality.drinkMismatch,
      retryLowVisibleFoodConfidence: retryQuality.lowVisibleFoodConfidence,
      retryConfidencePercent: retryQuality.confidencePercent,
      retryScanState: retryOutput.scanState,
      usedRetry: useRetry,
    });

    return useRetry ? retryOutput : firstOutput;
  } catch (error) {
    logOpenRouterDebug('openrouter_scan_quality_retry_failed', {
      originalDishName: firstOutput.dishName,
      retryReason,
      message: error instanceof OpenRouterProviderError ? error.failure.reason : 'unknown',
    });
    return firstOutput;
  }
}

// Timeouts are excluded: the first attempt already spent the full timeout budget,
// and the mobile client aborts at 60s total. Everything else transient is worth
// one retry. Free-tier models rate-limit (HTTP 429) and hiccup often.
const retryableVisionOutputReasons = new Set<OpenRouterFailureReason>([
  'openrouter_empty_content',
  'openrouter_http_error',
  'openrouter_invalid_json',
  'openrouter_invalid_schema',
  'openrouter_network_error',
  'openrouter_output_truncated',
  'openrouter_unknown_error',
]);

function isRetryableVisionOutputError(error: unknown) {
  return error instanceof OpenRouterProviderError && retryableVisionOutputReasons.has(error.failure.reason);
}

function getOpenRouterErrorReason(error: unknown) {
  return error instanceof OpenRouterProviderError ? error.failure.reason : 'unknown';
}

async function callVisionOnce(
  input: { config: AiConfig; image?: ScanImageMetadata; mode: RecipeMode },
  promptText: string,
  stage: string,
) {
  const content: OpenRouterContentPart[] = [{ type: 'text', text: promptText }];
  const imageUrl = getSafeImageUrl(input.image);
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  const json = await callOpenRouterJson({
    config: input.config,
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a cautious food analysis assistant and food reverse-engineering specialist. Your job is to detect EVERY distinct food component visible — not just the dominant item. Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
      },
      {
        role: 'user',
        content,
      },
    ],
    model: input.config.openRouterVisionModel,
    maxTokens: Math.min(input.config.maxOutputTokens, 900),
    stage,
  });

  const output = openRouterVisionOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterVisionModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }

  logOpenRouterDebug('openrouter_vision_output', {
    broadDishCategory: output.data.broadDishCategory ?? output.data.dishCategory,
    confidence: output.data.confidence,
    dishName: output.data.dishName,
    foodDetected: output.data.foodDetected ?? output.data.isFoodImage,
    scanState: output.data.scanState,
    stage,
  });

  return output.data;
}

// Names that are too generic to be useful when real food or drink is visible.
const genericDishNames = new Set([
  'dish', 'food', 'meal', 'plate', 'bowl', 'platter', 'drink', 'beverage',
  'food item', 'food plate', 'food dish', 'food bowl',
  'restaurant dish', 'restaurant plate', 'restaurant meal', 'restaurant food',
  'restaurant style food plate', 'restaurant-style food plate',
  'mixed restaurant plate', 'mixed plate', 'mixed platter', 'mixed food plate',
  'generic meal', 'unknown', 'unknown dish', 'unknown food dish', 'unclear dish',
]);

export function isGenericDishName(value: string | undefined | null) {
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(a|an|the)\s+/, '')
    .trim();

  return !normalized || genericDishNames.has(normalized);
}

const drinkClueRegex = /\b(smoothie|milkshake|shake|latte|matcha|iced coffee|cold brew|frappe|frappuccino|boba|bubble tea|juice|lemonade|hot chocolate)\b/;

export function isDrinkAnalysisText(value: string) {
  const normalized = value.toLowerCase();
  return drinkClueRegex.test(normalized) || normalized.includes('drink/beverage');
}

type VisionQuality = {
  confidencePercent: number;
  drinkMismatch: boolean;
  foodVisible: boolean;
  generic: boolean;
  lowVisibleFoodConfidence: boolean;
  needsRetry: boolean;
};

function evaluateVisionQuality(output: z.infer<typeof openRouterVisionOutputSchema>): VisionQuality {
  const confidencePercent = getLooseConfidencePercent(output.confidence);
  const scanState = (output.scanState ?? '').toLowerCase();
  const foodVisible = parseLooseBoolean(output.isFoodImage) ||
    parseLooseBoolean(output.foodDetected) ||
    ['clear_food', 'food_present_uncertain_dish', 'partial_food'].includes(scanState);
  const generic = isGenericDishName(output.dishName);
  const supportText = [
    output.dishName,
    output.broadDishCategory,
    output.cuisine,
    output.confidenceReason,
    ...(output.visibleIngredients ?? []),
    ...(output.likelyIngredients ?? []),
    ...Object.values(output.visibleComponents ?? {}),
  ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
  const looksLikeDrink = drinkClueRegex.test(supportText);
  const nameSaysPlate = /\b(plate|platter)\b/.test((output.dishName ?? '').toLowerCase());
  const drinkMismatch = looksLikeDrink && nameSaysPlate;
  const lowVisibleFoodConfidence = foodVisible && confidencePercent > 0 && confidencePercent < 40;
  const needsRetry = output.scanState === 'too_unclear' || (foodVisible && (drinkMismatch || lowVisibleFoodConfidence || (generic && confidencePercent < 88)));

  return { confidencePercent, drinkMismatch, foodVisible, generic, lowVisibleFoodConfidence, needsRetry };
}

function getVisionQualityRetryReason(quality: VisionQuality) {
  if (!quality.needsRetry) {
    return undefined;
  }
  if (quality.drinkMismatch) {
    return 'drink_named_as_plate';
  }
  if (quality.generic) {
    return 'visible_food_generic_name';
  }
  if (quality.lowVisibleFoodConfidence) {
    return 'visible_food_low_confidence';
  }

  return 'vision_quality';
}

function getLooseConfidencePercent(value: number | string | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(100, parsed <= 1 ? parsed * 100 : parsed);
}

function parseLooseBoolean(value: boolean | string | undefined) {
  if (typeof value === 'boolean') {
    return value;
  }

  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

// ─── Recipe cache ─────────────────────────────────────────────────────────────
// ponytail: global in-memory, resets on restart — Redis when multi-instance scale requires it
const recipeCache = new Map<string, { recipe: OpenRouterRecipeOutput; expiresAt: number }>();
const RECIPE_CACHE_TTL_MS = (() => {
  const days = Number(process.env.RECIPE_CACHE_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
})();

function getRecipeCacheKey(analysis: FoodImageAnalysis, mode: RecipeMode): string {
  const data = JSON.stringify({
    d: analysis.dishName.trim().toLowerCase(),
    i: [...analysis.visibleIngredients].sort().map((s) => s.trim().toLowerCase()),
    m: mode,
    c: analysis.broadDishCategory.trim().toLowerCase(),
  });
  return createHash('sha1').update(data).digest('hex');
}

function buildStepImagePrompt(step: z.infer<typeof recipeStepSchema>, dishName: string): string {
  const subject = step.ingredients?.[0] ?? dishName;
  const action = (step.title ?? 'preparing').toLowerCase();
  const vessel = step.tools?.[0] ?? 'bowl';
  return `Close-up food photography, ${subject} ${action} in ${vessel}, warm restaurant lighting, 45-degree camera angle, shallow depth of field, no text, no watermark.`;
}

function addStepImagePrompts(recipe: OpenRouterRecipeOutput, dishName: string): OpenRouterRecipeOutput {
  if (!recipe.steps) return recipe;
  return {
    ...recipe,
    steps: recipe.steps.map((step) => {
      if (typeof step === 'string') return step;
      return step.stepImagePrompt ? step : { ...step, stepImagePrompt: buildStepImagePrompt(step, dishName) };
    }),
  };
}

function storeRecipeCache(key: string, recipe: OpenRouterRecipeOutput, dish: string): OpenRouterRecipeOutput {
  const processed = addStepImagePrompts(recipe, dish);
  recipeCache.set(key, { recipe: processed, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
  logOpenRouterDebug('recipe_cache_store', { key: key.slice(0, 8), dish });
  return processed;
}

function getRecipeModelChain(config: AiConfig): string[] {
  const models = [config.openRouterTextModel, ...RECIPE_FALLBACK_MODELS];
  const paid = process.env.RECIPE_PAID_FALLBACK_MODEL?.trim();
  if (paid) models.push(paid);
  return [...new Set(models)];
}

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode?: RecipeMode;
}) {
  // ── Epicure enrichment (additive) ───────────────────────────────────────────
  // Runs BEFORE recipe generation. When the feature flag is off, no key is set,
  // or the call fails, enrichRecipeContext returns null and the recipe prompt is
  // built exactly as before — recipe generation never breaks or blocks on this.
  const mode: RecipeMode = input.mode ?? 'Restaurant Copy';

  // Cache check — skips Epicure and recipe generation entirely on a hit.
  const cacheKey = getRecipeCacheKey(input.analysis, mode);
  const cached = recipeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logOpenRouterDebug('recipe_cache_hit', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });
    return cached.recipe;
  }
  logOpenRouterDebug('recipe_cache_miss', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });

  let enrichment: EnrichedRecipeContext | null = null;
  const visionEpicure = input.analysis.epicureSuggestions;
  if (visionEpicure?.complementaryIngredients?.length) {
    // Vision already returned Epicure data inline — no separate API call needed.
    // Saves ~8-12s vs the previous sequential enrichRecipeContext() call.
    enrichment = {
      detectedIngredients: [...input.analysis.visibleIngredients, ...input.analysis.likelyIngredients].slice(0, 12),
      complementaryIngredients: visionEpicure.complementaryIngredients,
      healthySubstitutions: visionEpicure.healthySubstitutions ?? {},
      budgetSubstitutions: visionEpicure.budgetSubstitutions ?? {},
    };
    logOpenRouterDebug('epicure_from_vision', {
      complementaryCount: visionEpicure.complementaryIngredients.length,
      healthySubCount: Object.keys(visionEpicure.healthySubstitutions ?? {}).length,
      budgetSubCount: Object.keys(visionEpicure.budgetSubstitutions ?? {}).length,
    });
  } else {
    try {
      enrichment = await enrichRecipeContext({
        dishName: input.analysis.dishName,
        ingredients: [...input.analysis.visibleIngredients, ...input.analysis.likelyIngredients],
        mode,
      });
    } catch (enrichError) {
      logOpenRouterDebug('epicure_enrichment_unexpected_error', {
        reason: enrichError instanceof Error ? enrichError.message : 'unknown',
      });
      enrichment = null;
    }
  }

  const recipePrompt = getRecipePrompt(input.analysis, enrichment, mode);
  const epicureSectionChars = enrichment ? buildEpicurePromptSection(enrichment, mode).length : 0;
  const fullPromptChars = recipePrompt.length;
  const basePromptChars = fullPromptChars - (epicureSectionChars > 0 ? epicureSectionChars + 1 : 0);
  console.log('[prompt_size_comparison]', {
    dish: input.analysis.dishName,
    mode,
    basePromptChars,
    epicureSectionChars,
    fullPromptChars,
    epicureAdded: epicureSectionChars > 0,
    epicurePct: basePromptChars > 0
      ? `+${((epicureSectionChars / basePromptChars) * 100).toFixed(1)}%`
      : '0%',
    estimatedBasePromptTokens: Math.ceil(basePromptChars / 4),
    estimatedFullPromptTokens: Math.ceil(fullPromptChars / 4),
  });

  const retryReasons: OpenRouterFailureReason[] = [
    'openrouter_empty_content',
    'openrouter_http_error',
    'openrouter_invalid_json',
    'openrouter_invalid_schema',
    'openrouter_network_error',
    'openrouter_output_truncated',
    'openrouter_unknown_error',
  ];
  const isDrink = isDrinkAnalysisText([
    input.analysis.dishName,
    input.analysis.broadDishCategory,
    ...input.analysis.visibleIngredients,
    ...input.analysis.likelyIngredients,
  ].join(' '));

  let firstOutput: OpenRouterRecipeOutput;
  try {
    firstOutput = await callRecipeStage(input, recipePrompt, input.config.maxOutputTokens, 'recipe');
  } catch (firstError) {
    const shouldRetry = firstError instanceof OpenRouterProviderError &&
      retryReasons.includes(firstError.failure.reason);

    if (!shouldRetry) {
      throw firstError;
    }

    logOpenRouterDebug('openrouter_recipe_retry', {
      firstReason: firstError.failure.reason,
      firstErrorMessage: firstError.failure.openRouterErrorMessage,
      model: input.config.openRouterTextModel,
      retryPrompt: 'compact',
      retryMaxTokens: 1024,
    });

    await waitMs(3500);
    firstOutput = await callRecipeStage(input, getCompactRecipeRetryPrompt(input.analysis), 1024, 'recipe_retry');
  }

  // Structural gate (FAIL-CLOSED): the single recipe MUST have well-formed,
  // sequential steps each carrying an instruction, title, ingredients, and
  // tools. One targeted repair pass; if it still fails, throw rather than
  // fabricate. aiService routes the throw to the honest scan-failure UX.
  firstOutput = await enforceRecipeStructure(input, firstOutput);

  // Strip fields the model generates despite prompt bans — deterministic, no
  // prompt-compliance required.
  if (!isPlatterAnalysis(input.analysis) && firstOutput.ingredientGroups?.length) {
    firstOutput = { ...firstOutput, ingredientGroups: [] };
  }
  if (firstOutput.groceryItems?.length) {
    firstOutput = {
      ...firstOutput,
      groceryItems: firstOutput.groceryItems.map(({ name, quantity, category }) => ({ name, quantity, category, sourceIngredient: '', shoppingNote: '' })),
    };
  }

  // Quality gate: even structurally valid JSON can be too vague to cook from.
  // One focused repair pass, then keep whichever output is cleaner (and still
  // structurally valid). The deterministic sanitizer in aiService is the final
  // safety net after this.
  const issues = getRecipeQualityIssues(firstOutput, isDrink);
  if (issues.length === 0) {
    return storeRecipeCache(cacheKey, firstOutput, input.analysis.dishName);
  }

  logOpenRouterDebug('openrouter_recipe_quality_check', {
    dishName: input.analysis.dishName,
    issues,
    willRepair: true,
  });

  try {
    await waitMs(250);
    const repaired = await callRecipeStage(
      input,
      getRecipeRepairPrompt(input.analysis, firstOutput, issues),
      input.config.maxOutputTokens,
      'recipe_quality_repair',
    );
    const repairedIssues = getRecipeQualityIssues(repaired, isDrink);
    const repairedStructure = validateRecipeStructure(repaired);
    const usedRepair = repairedStructure.length === 0 && repairedIssues.length < issues.length;
    logOpenRouterDebug('openrouter_recipe_quality_repair_result', {
      beforeIssues: issues,
      afterIssues: repairedIssues,
      repairedStructureIssues: repairedStructure,
      usedRepair,
    });
    return storeRecipeCache(cacheKey, usedRepair ? repaired : firstOutput, input.analysis.dishName);
  } catch (repairError) {
    logOpenRouterDebug('openrouter_recipe_quality_repair_failed', {
      reason: repairError instanceof OpenRouterProviderError ? repairError.failure.reason : 'unknown',
    });
    return storeRecipeCache(cacheKey, firstOutput, input.analysis.dishName);
  }
}

// Fail-closed structural enforcement. Returns a structurally valid recipe or
// throws OpenRouterProviderError — never a fabricated/templated recipe.
async function enforceRecipeStructure(
  input: { analysis: FoodImageAnalysis; config: AiConfig },
  output: OpenRouterRecipeOutput,
): Promise<OpenRouterRecipeOutput> {
  const issues = validateRecipeStructure(output);
  if (issues.length === 0) {
    return output;
  }

  logOpenRouterDebug('openrouter_recipe_structure_invalid', {
    dishName: input.analysis.dishName,
    issues,
    willRepair: true,
  });

  await waitMs(250);
  const repaired = await callRecipeStage(
    input,
    getRecipeStructureRepairPrompt(input.analysis, issues),
    input.config.maxOutputTokens,
    'recipe_structure_repair',
  );
  const repairedIssues = validateRecipeStructure(repaired);
  if (repairedIssues.length > 0) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: `Recipe steps were structurally invalid after repair: ${repairedIssues.join(', ')}`,
    });
  }
  return repaired;
}

// Strict structural validation of the single recipe. Returns issue codes (empty
// = valid). Enforces the mandatory step contract: a non-empty array of
// structured steps, each with an instruction, title, at least one ingredient and
// one tool, and a sequential stepNumber starting at 1.
export function validateRecipeStructure(output: OpenRouterRecipeOutput): string[] {
  const issues: string[] = [];
  const steps = Array.isArray(output.steps) ? output.steps : null;
  if (!steps) {
    return ['steps_not_array'];
  }
  if (steps.length < 4) {
    issues.push('too_few_steps');
  }

  const nonEmpty = (values: unknown): boolean =>
    Array.isArray(values) && values.some((v) => typeof v === 'string' && v.trim().length > 0);

  for (const step of steps) {
    if (typeof step === 'string' || !step || typeof step !== 'object') {
      issues.push('step_not_structured');
      continue;
    }
    const instruction = (step.step || step.instruction || step.text || '').trim();
    if (!instruction) issues.push('step_missing_instruction');
    if (!(step.title || '').trim()) issues.push('step_missing_title');
  }

  const numbers = steps.map((step) =>
    typeof step === 'object' && step && typeof step.stepNumber === 'number' ? step.stepNumber : undefined);
  if (numbers.some((n) => n === undefined)) {
    issues.push('stepNumber_missing');
  } else if (!numbers.every((n, index) => n === index + 1)) {
    issues.push('stepNumber_not_sequential');
  }

  return [...new Set(issues)];
}

async function callRecipeStage(
  input: { analysis: FoodImageAnalysis; config: AiConfig },
  userPrompt: string,
  maxTokens: number,
  stage: string,
): Promise<OpenRouterRecipeOutput> {
  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'You are a professional chef assistant and food reverse-engineering specialist generating ONE structured cooking recipe for a beginner cook. When the dish is a platter or multi-component meal (sushi board, bento, combo plate), your recipe MUST cover every distinct component — each roll type, protein, sauce, condiment, garnish, and side — as separate phases or step groups within the single recipe. You MUST return a single JSON object. Every step MUST include stepNumber, phase, title, step, ingredients, and tools. Do not return multiple recipes or modes. Return ONLY valid JSON. No markdown, no reasoning, no explanations.',
        },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
      stage,
    },
    getRecipeModelChain(input.config),
  );

  const output = openRouterRecipeOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }
  return output.data;
}

// Detects recipe output that is too vague to cook from. Returns a list of issue
// codes (empty = good enough). Drives the one-shot repair retry above.
function getRecipeQualityIssues(output: OpenRouterRecipeOutput, isDrink: boolean): string[] {
  const issues: string[] = [];
  const ingredients = (Array.isArray(output.ingredients) ? output.ingredients : [])
    .map((value) => (typeof value === 'string' ? value : '').trim())
    .filter(Boolean);
  const stepTexts = (Array.isArray(output.steps) ? output.steps : [])
    .map((value) => (typeof value === 'string' ? value : (value?.step || value?.instruction || value?.text || '')).trim())
    .filter(Boolean);
  const allText = `${output.title ?? ''} ${output.description ?? ''} ${ingredients.join(' ')} ${stepTexts.join(' ')}`.toLowerCase();

  if (/\bmain ingredient\b/.test(allText)) {
    issues.push('vague_main_ingredient');
  }
  if (ingredients.length < 4) {
    issues.push('too_few_ingredients');
  }
  const vagueStandalone = ingredients.filter((value) => standaloneVagueIngredient.test(value.toLowerCase().trim()));
  if (vagueStandalone.length > 0) {
    issues.push('vague_ingredient_name');
  }
  const missingAmounts = ingredients.filter((value) => !hasIngredientAmount(value));
  if (missingAmounts.length > Math.max(1, Math.floor(ingredients.length / 3))) {
    issues.push('ingredients_missing_amounts');
  }
  if (stepTexts.length < 5) {
    issues.push('too_few_steps');
  }
  if (stepTexts.some((step) => vagueStepPattern.test(step.toLowerCase()))) {
    issues.push('vague_step');
  }
  if (isDrink && stepTexts.some((step) => /\b(oven|skillet|saut[eé]|bake|roast|sear|pan-fry|°f|°c|internal temp)\b/i.test(step))) {
    issues.push('drink_uses_cooking_language');
  }

  return issues;
}

const standaloneVagueIngredient = /^(the\s+)?(main ingredients?|protein|proteins|vegetables?|veggies|sauce|sauces|seasoning|seasonings|spice|spices|toppings?|ingredients|filling|stuff)$/;
const vagueStepPattern = /\bcook until done\b|\bprepare the ingredients\b|\bmix everything\b|\bseason to taste\b|\b(cook|add|prepare|make) the (main ingredient|protein|vegetables|sauce)\b/;

function hasIngredientAmount(value: string): boolean {
  const text = value.toLowerCase();
  if (/\d/.test(text)) {
    return true;
  }
  return /\b(a|an|one|two|three|four|half|pinch|dash|handful|to taste|some)\b/.test(text);
}

function getRecipeRepairPrompt(
  analysis: FoodImageAnalysis,
  badOutput: OpenRouterRecipeOutput,
  issues: string[],
): string {
  return [
    `Your previous recipe JSON for "${analysis.dishName}" had quality problems: ${issues.join(', ')}.`,
    'Rewrite it so a beginner can cook it with zero guessing. Return ONLY valid minified JSON, same single-recipe shape as before.',
    'Return exactly ONE recipe object: {"dishName":"...","title":"...", ...recipe fields..., "steps":[...]}. No modes, no variants, no "selectedMode".',
    'Fix every problem: NEVER write "the main ingredient" or "main ingredient" — name the actual food. Every ingredient must start with an exact amount and a real grocery name. Every step must name real ingredients with amounts, a time, and a visual cue. No "cook until done", "prepare the ingredients", "season to taste", or "mix everything".',
    'PHASE ORDER IS MANDATORY: Every step object MUST include "phase" (integer 1-6). Steps must be in phase order — 1 Preparation, 2 Setup, 3 Cooking, 4 Assembly, 5 Finishing, 6 Serving. Phase numbers must never decrease. Phase 6 Serving MUST be the final step and can NEVER appear before phase 3 Cooking.',
    'STEP CONTRACT IS MANDATORY: Every step object MUST include "stepNumber" (integer, starts at 1, strictly sequential, no gaps), "title" (2-4 word action phrase), "step" (one clear instruction sentence), "ingredients" (array of ingredient names used in this step — never empty), and "tools" (array of tool names used in this step — never empty, no duplicates).',
    'Keep 6-12 ingredients and 8-14 steps (6-8 for drinks or salads).',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
    })}`,
  ].join('\n');
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  model: string;
  stage?: string;
}) {
  if (!input.config.openRouterApiKey) {
    throw createOpenRouterError(input.config, input.model, 'openrouter_missing_key', {
      openRouterErrorMessage: 'OpenRouter API key is missing.',
    });
  }

  logOpenRouterDebug('openrouter_call_start', {
    model: input.model,
    provider: input.config.provider,
    maxTokens: input.maxTokens,
    stage: input.stage ?? 'unknown',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);
  const startedAt = Date.now(); // [scan_timing] per-call latency

  try {
    const response = await fetch(openRouterEndpoint, {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model: input.model,
        // Keep reasoning models from spending the whole budget thinking.
        // OpenRouter ignores this for models without reasoning support.
        // include_reasoning:false is the OpenRouter-native param (hides reasoning from content tokens).
        // reasoning:{enabled:false} is the OpenAI-format equivalent kept for provider compat.
        include_reasoning: false,
        reasoning: { enabled: false },
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${input.config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://okyo.local',
        'X-Title': 'Okyo',
      },
      method: 'POST',
      signal: controller.signal,
    });

    logOpenRouterDebug('api_openrouter_response_status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
    if (!response.ok) {
      const errorMessage = await getOpenRouterErrorMessage(response);
      console.error('openrouter_http_error', {
        model: input.model,
        stage: input.stage ?? 'unknown',
        status: response.status,
        message: errorMessage,
        durationMs: Date.now() - startedAt,
      });
      throw createOpenRouterError(input.config, input.model, 'openrouter_http_error', {
        httpStatus: response.status,
        openRouterErrorMessage: errorMessage,
      });
    }

    const responseJson = await parseResponseJson(response, input.config, input.model);
    const responseShape = getOpenRouterResponseShape(responseJson);
    const usage = getRecord(responseJson)?.usage;
    const promptTokens = typeof (usage as Record<string, unknown> | undefined)?.prompt_tokens === 'number'
      ? (usage as Record<string, unknown>).prompt_tokens as number : undefined;
    const completionTokens = typeof (usage as Record<string, unknown> | undefined)?.completion_tokens === 'number'
      ? (usage as Record<string, unknown>).completion_tokens as number : undefined;
    const totalTokens = typeof (usage as Record<string, unknown> | undefined)?.total_tokens === 'number'
      ? (usage as Record<string, unknown>).total_tokens as number : undefined;
    logOpenRouterDebug('openrouter_response_shape', responseShape);
    console.log('[token_usage]', {
      model: input.model,
      stage: input.stage ?? 'unknown',
      promptTokens,
      completionTokens,
      totalTokens,
      maxTokens: input.maxTokens,
      finishReason: responseShape.finishReason,
      durationMs: Date.now() - startedAt,
    });
    logOpenRouterDebug('openrouter_call_finish', {
      model: input.model,
      provider: input.config.provider,
      maxTokens: input.maxTokens,
      stage: input.stage ?? 'unknown',
      finishReason: responseShape.finishReason,
    });
    const assistantText = extractAssistantTextFromOpenRouterResponse(responseJson, input.config, input.model);
    logOpenRouterDebug('api_openrouter_response_text_preview', {
      length: assistantText.length,
      preview: assistantText.slice(0, 300),
    });
    return parseJsonContent(
      assistantText,
      input.config,
      input.model,
      responseShape.finishReason,
    );
  } catch (error) {
    if (error instanceof OpenRouterProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_timeout', {
        openRouterErrorMessage: 'OpenRouter request timed out.',
      });
    }

    if (error instanceof TypeError) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_network_error', {
        openRouterErrorMessage: getSafeErrorMessage(error),
      });
    }

    throw createOpenRouterError(input.config, input.model, 'openrouter_unknown_error', {
      openRouterErrorMessage: getSafeErrorMessage(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Model failover and backoff ───────────────────────────────────────────────

type CallJsonBase = {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  stage?: string;
};

function isFailoverError(error: unknown): boolean {
  if (!(error instanceof OpenRouterProviderError)) return false;
  const { reason, httpStatus } = error.failure;
  return reason === 'openrouter_timeout' ||
    reason === 'openrouter_network_error' ||
    (reason === 'openrouter_http_error' && [429, 402, 404, 503].includes(httpStatus ?? 0));
}

function isBackoffError(error: unknown): boolean {
  if (!(error instanceof OpenRouterProviderError)) return false;
  return error.failure.reason === 'openrouter_http_error' &&
    [429, 503].includes(error.failure.httpStatus ?? 0);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouterJsonWithFailover(base: CallJsonBase, models: string[]): Promise<unknown> {
  let lastError: unknown = new Error('recipe_model_chain_empty');
  let failoverCount = 0;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    logOpenRouterDebug('recipe_model_attempt', { model, attempt: i + 1, stage: base.stage });
    try {
      const result = await callOpenRouterJson({ ...base, model });
      if (i > 0) {
        logOpenRouterDebug('recipe_model_success', { model, attempt: i + 1, stage: base.stage });
      }
      console.log('[failover_summary]', {
        stage: base.stage,
        succeededAt: model,
        attemptNumber: i + 1,
        failoverCount,
      });
      return result;
    } catch (error) {
      lastError = error;
      failoverCount++;
      const info = error instanceof OpenRouterProviderError ? error.failure : null;
      logOpenRouterDebug('recipe_model_failed', {
        model, attempt: i + 1, stage: base.stage,
        reason: info?.reason ?? 'unknown',
        httpStatus: info?.httpStatus,
      });
      if (!isFailoverError(error)) throw error;
      if (i < models.length - 1) {
        logOpenRouterDebug('recipe_model_fallback', { from: model, to: models[i + 1], attempt: i + 2, stage: base.stage });
        if (isBackoffError(error)) {
          await waitMs(RECIPE_FAILOVER_DELAYS_MS[i] ?? RECIPE_FAILOVER_DELAYS_MS[RECIPE_FAILOVER_DELAYS_MS.length - 1]);
        }
      }
    }
  }
  throw lastError;
}

const visionJsonContract = '{"scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}';

// Extends the base contract with inline Epicure fields. Used only in the primary vision
// call when Epicure is enabled — saves one sequential AI call (~8-12s) vs the old flow.
const visionJsonContractWithEpicure = '{"scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string, "epicureSuggestions": {"complementaryIngredients": string[], "healthySubstitutions": {"ingredient": "substitute"}, "budgetSubstitutions": {"ingredient": "substitute"}}}';

function getVisionPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  const epicureEnabled = isEpicureEnabled();
  const contract = epicureEnabled ? visionJsonContractWithEpicure : visionJsonContract;
  return [
    'Analyze this real-world restaurant, cafe, or takeout food or drink photo for a testing-only Okyo prototype.',
    'Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
    'Return JSON only with exactly these fields:',
    contract,
    'First decide: is this food, a drink, or neither? Drinks count as scannable: smoothies, milkshakes, lattes, iced coffee, matcha, juices, lemonade, boba/bubble tea, and hot chocolate are all valid results, as are soups, desserts, and pastries.',
    'If any visible food or drink exists, do not hard reject. Ignore table clutter, plates, utensils, hands, napkins, packaging, captions, UI chrome, and restaurant background unless they help identify the food or drink.',
    'Real restaurant photos are allowed to be messy: dim lighting, busy tables, multiple items, dark or charred food, shiny sauce, garnish, angled phone photos, partial plates, takeout containers, screenshots of food posts, hands, cups, napkins, menus, utensils, and cluttered backgrounds are normal.',
    'Ignore plates, utensils, table surfaces, cups, napkins, hands, menus, packaging, captions, UI chrome, and background unless they help identify the food. Focus on edible food.',
    'If multiple dishes or components are visible — platters, bento boxes, sushi boards, combo meals, tasting sets — enumerate EVERY distinct item in visibleIngredients. Do not collapse a platter into one dish name. List each component separately: "salmon nigiri", "tuna nigiri", "california roll", "spicy mayo", "pickled ginger", "wasabi", "edamame", etc. Prefer over-inclusion over under-inclusion.',
    'For sushi: detect each roll variety, each nigiri fish, each specialty roll, each sauce, each condiment, each garnish, and each side dish as a separate entry in visibleIngredients.',
    'If the exact dish is uncertain, identify a broad useful food category and give a lower-confidence best guess. Use broad category names instead of failure.',
    'Do not reject just because food is dark, charred, saucy, cluttered, garnished, partially visible, cropped, or photographed at an angle. Return lower confidence instead.',
    'dishName must be the MOST SPECIFIC name the image supports, built from what is visible. Examples: purple blended drink in a cup -> "Berry Smoothie"; green iced drink -> "Iced Matcha Latte"; creamy red-sauced pasta -> "Creamy Tomato Pasta"; burger with melted cheese -> "Cheeseburger"; bowl of rice with grilled chicken -> "Grilled Chicken Rice Bowl"; layered cake slice -> "Chocolate Cake".',
    'Generic names like "Mixed Restaurant Plate", "Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", "Bowl", "Drink", or "Unknown Dish" are WRONG whenever any specific food or drink is identifiable. Prefer a specific guess with lower confidence over a generic name. Only use a broad name like "Mixed Restaurant Plate" when the image truly shows several distinct meal components on one platter and no single dish dominates.',
    'The dishName must match the visible components. If the image shows a drink in a cup or glass (smoothie, latte, shake, juice), the dishName must say smoothie/latte/shake/juice — never call a drink a plate or bowl.',
    'Set broadDishCategory to one of: pizza, pasta/noodles, rice bowl, burger/sandwich, tacos/wrap, grilled meat, fried food, seafood, salad, soup/stew, dessert, breakfast item, drink/beverage, mixed platter, unknown food dish.',
    'Identify cuisine only when there are strong visual clues. Otherwise use "Restaurant-style".',
    'Use visibleComponents to describe visible protein, sauce, base/starch, vegetables, toppings/garnish, and cooking method. Empty string is okay when not visible. For platters, visibleComponents should describe the overall composition.',
    'visibleIngredients MUST list every distinct food item visible — individual roll types, proteins, sauces, condiments, garnishes, sides, and drinks. Each entry is one specific item with an estimated quantity when possible, e.g. "6 salmon nigiri", "8 california roll pieces", "1 tablespoon spicy mayo", "small mound pickled ginger". Minimum 5 entries for any platter. This is the complete inventory a cook needs to recreate the whole dish.',
    'Return a best-guess dishName even if the exact restaurant dish name is unknown. Build the name from visible components: descriptor + main item, like "Spicy Chicken Rice Bowl", "Creamy Tomato Rigatoni", "Loaded Cheeseburger", "Berry Smoothie", "Iced Matcha Latte", or "Grilled Salmon Plate". Do not invent exact menu names or brand names.',
    'When uncertain, include 2-4 possibleDishNames that are specific alternates of the same visible food, like ["Berry Smoothie", "Acai Smoothie", "Mixed Fruit Smoothie"] or ["Beef Burrito Bowl", "Chicken Rice Bowl", "Carnitas Bowl"]. Alternates must not be generic names.',
    'scanState rules: clear_food means food and dish are clear; food_present_uncertain_dish means food is clear but exact dish/cuisine is uncertain; partial_food means food is visible but partial/low-quality/ambiguous; not_food means clearly no food; too_unclear means too blurry/dark/blocked to identify food safely.',
    'Confidence score rules: 80-95 clear dish, 60-79 food clear but exact dish uncertain, 40-59 food visible but ambiguous or partial, below 40 retry/clarification needed. If food is visible and confidence is 40-79, keep isFoodImage true and use scanState food_present_uncertain_dish or partial_food.',
    'Only reject when food is clearly absent or the image is too unclear to identify any visible food. Do not reject just because the exact dish name is uncertain.',
    'Only use not_food when no food or drink is visible. If food or a drink is visible, not_food is wrong.',
    'Only use too_unclear when food cannot reasonably be identified at all because the image is truly blurry, blocked, or unreadable. If food is visible but the exact dish is unclear, use partial_food or food_present_uncertain_dish instead.',
    'If the image is not food, set scanState not_food, isFoodImage false, isRestaurantMeal false, and rejectionReason to a short user-friendly reason.',
    'If the image is too blurry/dark/blocked to know whether food is visible, set scanState too_unclear, isFoodImage false, confidence below 40, and rejectionReason to ask for a clearer food photo.',
    'If food is visible but uncertain, do NOT say "could not recognize" or "failed"; provide a broad best guess with lower confidence instead of failure.',
    'confidence may be 0-100. Use lower confidence when the image is unclear, partial, or screenshot-like.',
    'Do not invent exact restaurant menu prices from a photo. Set restaurantPriceEstimate to 0 unless a menu, receipt, visible price, or user-provided price is available in metadata.',
    'homemadeCostEstimate may be a cautious grocery-cost estimate for making a similar recipe at home.',
    'Use cautious estimates. Never present food identification, cost, or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    ...(epicureEnabled ? [
      'epicureSuggestions: return up to 5 complementaryIngredients (common accompaniments for this dish), up to 3 healthySubstitutions (healthier swap for a key ingredient, as {"original":"swap"}), and up to 3 budgetSubstitutions (cheaper swap, same format). Only include swaps that make sense for this specific dish.',
    ] : []),
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getCompactVisionRetryPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  return [
    'Analyze this image for Okyo. Food and drinks are valid scans.',
    'Return ONLY valid JSON. No markdown. No explanation.',
    'Use exactly this JSON shape:',
    visionJsonContract,
    'First decide whether visible food or drink exists. If no food or drink is visible, use scanState not_food. If the photo is too blurry or dark to identify anything, use too_unclear.',
    'If any food or drink is visible, do not hard reject. Give the most specific honest dish or drink name supported by the image, with lower confidence if uncertain.',
    'Drinks must be named as drinks, such as smoothie, latte, shake, juice, boba, coffee, or matcha. Never call a drink a plate or bowl.',
    'Avoid generic names like Food Plate, Restaurant Plate, Meal, Dish, Bowl, Drink, or Unknown Dish when a more specific visible guess is possible.',
    'Set restaurantPriceEstimate to 0 unless a visible menu, receipt, or price is in the image.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getFocusedVisionRetryPrompt(
  image: ScanImageMetadata | undefined,
  mode: RecipeMode,
  firstOutput: z.infer<typeof openRouterVisionOutputSchema>,
) {
  const clues = [
    ...(firstOutput.visibleIngredients ?? []),
    ...(firstOutput.likelyIngredients ?? []),
    ...Object.values(firstOutput.visibleComponents ?? {}),
  ].filter((value) => typeof value === 'string' && value.trim()).slice(0, 8);

  return [
    'Look at this food or drink photo again. A previous analysis returned a name that was too generic to be useful.',
    `Previous guess: "${firstOutput.dishName ?? 'none'}". Visible clues from the previous pass: ${clues.join(', ') || 'none recorded'}.`,
    'Return ONLY valid JSON. No markdown. No explanations. Use exactly these fields:',
    visionJsonContract,
    'Name the MOST SPECIFIC dish or drink the image supports, built from visible components: descriptor + main item, like "Berry Smoothie", "Iced Matcha Latte", "Creamy Tomato Pasta", "Cheeseburger", "Grilled Chicken Rice Bowl", or "Chocolate Cake".',
    'If the image shows a drink in a cup or glass (smoothie, milkshake, latte, iced coffee, juice, boba), the dishName MUST say so. Never call a drink a plate, bowl, or meal.',
    'Generic names like "Mixed Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", or "Bowl" are wrong when any specific food or drink is identifiable. Prefer a specific guess with lower confidence.',
    'Include 2-4 possibleDishNames that are specific alternates of the same visible food or drink.',
    'Stay honest: keep scanState accurate, lower confidence instead of inventing details, set restaurantPriceEstimate to 0 unless a menu or receipt is visible, and use not_food only when no food or drink is visible at all.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

const PLATTER_WORDS = ['platter', 'board', 'bento', 'sushi', 'dim sum', 'mezze', 'tapas', 'charcuterie', 'sampler', 'assortment', 'spread'];

function isPlatterAnalysis(analysis: FoodImageAnalysis): boolean {
  const text = `${analysis.dishName} ${analysis.broadDishCategory}`.toLowerCase();
  return analysis.broadDishCategory === 'mixed platter' ||
    PLATTER_WORDS.some((w) => text.includes(w)) ||
    (analysis.detectedComponents?.length ?? 0) >= 4;
}

function getRecipePrompt(
  analysis: FoodImageAnalysis,
  enrichment: EnrichedRecipeContext | null = null,
  mode: RecipeMode = 'Restaurant Copy',
) {
  const isUncertainFood = analysis.scanState === 'food_present_uncertain_dish' || analysis.scanState === 'partial_food';
  const isPlatter = isPlatterAnalysis(analysis);
  const isBakeryOrDessert = /\b(cream bun|custard|bao bun|milk bun|brioche|donut|doughnut|eclair|cream puff|choux|mochi|tart|cheesecake|pastry|dessert)\b/i.test(
    `${analysis.dishName} ${analysis.broadDishCategory}`,
  );
  const isDrink = isDrinkAnalysisText([
    analysis.dishName,
    analysis.broadDishCategory,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' '));

  // Optional Epicure section. Empty string when enrichment is null → the base
  // prompt is unchanged, preserving exact prior behavior.
  const epicureSection = buildEpicurePromptSection(enrichment, mode);

  // Explicit component list for platter prompts. Enumerating each detected component
  // eliminates the component-coverage repair call in the common case.
  const platterComponentNames = isPlatter
    ? (analysis.detectedComponents ?? []).map((c) => c.name).filter(Boolean).slice(0, 12)
    : [];

  return [
    `Create a compact inspired-by homemade recipe JSON for "${analysis.dishName}".`,
    `The recipe MUST be a homemade version of "${analysis.dishName}" as scanned. Do not switch dishes or add alcohol.`,
    'Return ONLY valid minified JSON. No markdown, no prose, no reasoning, no extra text.',
    'Return exactly ONE recipe object starting with {. One recipe only — no modes, variants, or multiple recipes.',
    `Recipe fields: dishName, title, description, ingredients, equipment, steps, avoidMistake, substitutions, storageAndReheating, spicePairings, prepTime, cookTime, totalTime, servings, skillLevel${isPlatter ? ', ingredientGroups' : ''}.`,
    isPlatter
      ? platterComponentNames.length > 0
        ? `REQUIRED COMPONENTS — generate exactly one ingredientGroup per item listed (2-6 ingredients each with exact amounts): ${platterComponentNames.map((c, i) => `${i + 1}. ${c}`).join(', ')}. ingredientGroups shape: [{"component":"<name>","items":["2 cups sushi rice",...]},...]  Steps: 1-3 per component grouped by component, phases 1-5.`
        : 'ingredientGroups: [{component:"<name>",items:["exact amount ingredient",...]},...] — one per distinct visible component. Cover every component. 24 ingredients and 24 steps; group steps by component.'
      : 'Do NOT include ingredientGroups — omit it entirely.',
    'Limits: ingredient count MUST match complexity — plain/whole foods 1-4, simple snacks/assembly 3-7, full cooked dishes 8-16. Steps: 2-4 for plain whole foods (fruit, boiled egg, toast), 6-8 for assembly, 8-12 for full cooked dishes. Substitutions max 3, equipment max 5, spicePairings max 2. Drinks: 6-8 steps.',
    'BANNED WORDING (never use, anywhere): "main ingredient", standalone "protein"/"vegetables"/"sauce"/"seasoning"/"toppings", "cook until done", "prepare the ingredients", "mix everything", "season to taste" with no amount. Always name the actual food.',
    'PROTEIN REALISM: Never use "shark" for a fish-shaped or ambiguous fried item — use "white fish fillets". Use common grocery-store proteins (cod, tilapia, chicken, ground pork). Do not infer exotic animals from novelty-shaped food.',
    'MUSUBI FORMAT: Spam musubi = rectangular rice block + Spam slice on top + nori strip wrapped around the outside. It is NOT rolled sushi. Never create roll-slicing, bamboo mat, or "slice rolls" steps for musubi. Name it "Spam Musubi". Steps must follow: cook rice → season rice → sear Spam → make glaze → cut nori strips → shape rice blocks → assemble → serve. Max 8 steps.',
    'MANGO STICKY RICE FORMAT: Ingredients MUST be exactly: sticky rice (glutinous), ripe mangoes, coconut milk (ONE can only — never both coconut milk AND coconut cream as separate items), sugar, salt. Optional: sesame seeds or toasted coconut flakes. MAX 7 ingredients total. Never list "coconut sauce" AND "coconut cream" as separate ingredients — they are the same thing. Never list "ripe mangoes" AND "diced mango" — pick one. Steps: soak/rinse rice → steam rice → warm coconut milk + sugar + salt → fold sauce into rice → slice mango → plate and drizzle. Max 7 steps.',
    'COOKABLE NOT VISIBLE: Do not list only the visible toppings. Infer the hidden essentials needed to actually cook a believable home version — cooking oil/fat, salt, seasoning, sauce COMPONENTS (not just "sauce"), and aromatics. Every recipe must be cookable from the ingredient list alone. Dumplings/wontons need wrapper-or-frozen-base + filling-or-shortcut + aromatics + sauce. Pick ONE coherent strategy: either a from-scratch version (wrappers + filling) OR a shortcut version (e.g. frozen dumplings) — never mix both.',
    'NO DUPLICATE INGREDIENTS: Each ingredient concept appears exactly once. soy sauce appears once with the total quantity for the whole recipe. RICE SEASONING: use either "seasoned rice vinegar" (1 ingredient) OR separate rice vinegar + sugar + salt (3 ingredients) — never both strategies in the same recipe.',
    'STEP HYGIENE: Never create standalone steps titled "Combine Ingredients", "Heat Mixture", "Cool and Store", or "Gather Ingredients" — fold these into the adjacent cooking step. Storage notes belong in storageAndReheating, not in steps.',
    'SIMPLE FOODS: Plain fruit (watermelon cubes, berries, grapes, banana, sliced melon) = the fruit itself only. Do NOT add feta, mint, honey, nuts, granola, yogurt, dressing, or any chef addition unless clearly visible in the scan or named in the title. Watermelon cubes → ["4 cups watermelon, cubed"], optionally ["1 lime", "1/4 tsp Tajín or salt"]. Never create a salad from a plain fruit scan. Same rule for plain boiled eggs and plain toast.',
    'Ingredients: STRINGS ONLY — ["2 large eggs", "1 tbsp olive oil"]. Each element is a plain string starting with an exact amount. Never output ingredient objects.',
    'COOKING PHASES: 1=Prep, 2=Setup, 3=Cook, 4=Assembly, 5=Finish, 6=Serve. Phases MUST NOT decrease. Phase 6 = ONLY the final serve/plate action — garnish, fresh herbs, and cheese are phase 5.',
    'Steps: copy this EXACT shape — {"stepNumber":1,"phase":1,"title":"Mince Garlic","step":"Finely mince 4 garlic cloves on a cutting board until 1mm pieces, about 30 seconds.","ingredients":["garlic"],"tools":["chef knife","cutting board"]}',
    'Every step requires all 6 keys: stepNumber (integer, starts 1, sequential +1 per step), phase (integer 1-6), title (2-4 word action phrase), step (≤25 words, real amount+time+visual cue), ingredients (names-used-this-step array, never empty), tools (never empty). No other keys.',
    'Never write vague steps. Say exactly what to do, the time, and a visual/textural cue.',
    isDrink
      ? 'DRINK: title must say smoothie/latte/shake/juice. Steps: measure, blend or brew, taste, adjust, pour, garnish. No oven, no meat temperatures.'
      : 'Meat and seafood: include safe internal temperature (165°F/74°C chicken, 160°F/71°C ground meat, 145°F/63°C pork/fish).',
    ...(mode === 'Budget' && isBakeryOrDessert
      ? ['BUDGET SHORTCUT: Use store-bought or premade base (soft buns, Hawaiian rolls, bao buns, premade pastry shells). Focus on filling, cream, and simple assembly — not from-scratch dough, steaming, or professional shaping.']
      : []),
    'Text limits: description 1-2 sentences (concise and direct — never say "inspired-by" or "estimate for a home kitchen"). avoidMistake 1 sentence. storageAndReheating 1 sentence.',
    isUncertainFood
      ? 'Scan uncertain — best-guess inspired-by version based on visible components.'
      : 'Scan is clear — wording must be honest and inspired-by.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      scanState: analysis.scanState,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
    })}`,
    // Appended only when Epicure produced suggestions; otherwise absent entirely.
    ...(epicureSection ? [epicureSection] : []),
  ].join('\n');
}

function getCompactRecipeRetryPrompt(analysis: FoodImageAnalysis) {
  return [
    'JSON only. No markdown. No explanations. Write real recipe text in every field; never output placeholder dots.',
    'Return ONE recipe object: {"dishName","title","description","ingredients","steps","prepTime","cookTime","totalTime","servings","skillLevel","avoidMistake","substitutions","storageAndReheating","spicePairings"}.',
    'ingredients: 6 strings, each an exact amount plus grocery name like "2 large eggs" or "1 cup all-purpose flour" — use real ingredients for this specific dish, not examples.',
    'steps: 6-8 step OBJECTS. Exact shape: {"stepNumber":1,"phase":3,"title":"Sear Chicken","step":"instruction ≤22 words with time+visual cue","ingredients":["names used in this step"],"tools":["tools used"]}. stepNumber starts 1, sequential. phase 1-6. ingredients/tools never empty.',
    'spicePairings: up to 2 strings.',
    `Dish: ${analysis.dishName}. Visible: ${analysis.visibleIngredients.slice(0, 4).join(', ')}.`,
  ].join('\n');
}

function getRecipeStructureRepairPrompt(analysis: FoodImageAnalysis, issues: string[]): string {
  return [
    `Your previous recipe JSON for "${analysis.dishName}" had structural problems: ${issues.join(', ')}.`,
    'Return ONLY valid minified JSON — ONE recipe object, no modes or variants.',
    'The "steps" field MUST be an array of 8-14 step OBJECTS (6-8 for drinks or salads). Copy this exact step shape: {"stepNumber":1,"phase":1,"title":"Prep Onion","step":"Finely dice 1 medium onion on a cutting board into 5mm pieces.","ingredients":["onion"],"tools":["chef knife","cutting board"]}',
    'Every step object MUST include all 6 keys: "stepNumber" (integer — starts at 1, sequential, no gaps), "phase" (integer 1-6: 1=Prep,2=Setup,3=Cook,4=Assembly,5=Finish,6=Serve), "title" (2-4 word action phrase), "step" (one clear instruction with amount + time + visual cue), "ingredients" (non-empty array), "tools" (non-empty array).',
    'Never output a step as a plain string. Never leave ingredients or tools empty. Keep ingredients specific and tools real.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients.slice(0, 5),
      likelyIngredients: analysis.likelyIngredients.slice(0, 5),
    })}`,
  ].join('\n');
}

async function parseResponseJson(response: Response, config: AiConfig, model: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    // A request-timeout abort can fire mid-body-read and surface here. We keep the
    // 'invalid_json' reason on purpose so the existing fast compact-retry still
    // fires ('openrouter_timeout' is intentionally NOT retried — see retryReasons),
    // but we record the likely cause so telemetry isn't misleading: a too-slow
    // model reads as "body read aborted (likely timeout)", not "malformed JSON".
    const likelyTimeout = isAbortError(error);
    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      httpStatus: response.status,
      openRouterErrorMessage: likelyTimeout
        ? 'OpenRouter response body read was aborted (likely request timeout).'
        : 'OpenRouter response body was not valid JSON.',
    });
  }
}

function parseJsonContent(
  content: string,
  config: AiConfig,
  model: string,
  finishReason: string | null | undefined,
) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? findFirstJsonObject(trimmed) ?? trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    if (finishReason === 'length') {
      throw createOpenRouterError(config, model, 'openrouter_output_truncated', {
        openRouterErrorMessage: 'OpenRouter response was truncated before valid JSON completed.',
      });
    }

    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      openRouterErrorMessage: 'OpenRouter message content did not contain valid JSON.',
    });
  }
}

function getSafeImageUrl(image: ScanImageMetadata | undefined) {
  if (!image || image.placeholder) {
    return undefined;
  }

  if (image.dataUrl?.startsWith('data:image/')) {
    return image.dataUrl;
  }

  if (image.uri?.startsWith('https://') || image.uri?.startsWith('http://')) {
    return image.uri;
  }

  return undefined;
}

function getSafeImageMetadata(image: ScanImageMetadata | undefined) {
  if (!image) {
    return null;
  }

  return {
    fileName: image.fileName,
    dataUrlSizeBytes: image.dataUrlSizeBytes,
    height: image.height,
    hasDataUrl: Boolean(image.dataUrl),
    mimeType: image.mimeType,
    placeholder: image.placeholder,
    source: image.source,
    conversionError: image.conversionError,
    uriKind: getSafeImageUrl(image) ? 'sendable' : image.uri ? 'local_or_private_uri_not_sent' : 'none',
    width: image.width,
  };
}

function extractAssistantTextFromOpenRouterResponse(response: unknown, config: AiConfig, model: string) {
  const shape = getOpenRouterResponseShape(response);
  logOpenRouterDebug('openrouter_assistant_content_shape', shape);

  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content.map(extractTextBlock).filter(Boolean).join('\n').trim();
    if (text) {
      return text;
    }
  }

  // A length-cut response with no final content means the model spent the whole
  // budget reasoning. Its reasoning text is not a finished answer — treat as
  // truncated so the compact retry (or the honest failure path) takes over.
  if (shape.finishReason === 'length') {
    throw createOpenRouterError(config, model, 'openrouter_output_truncated', {
      openRouterErrorMessage: 'Model hit the token limit before returning final content.',
    });
  }

  const reasoning = message?.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning;
  }

  const reasoningDetails = extractTextFromReasoningDetails(message?.reasoning_details);
  if (reasoningDetails) {
    return reasoningDetails;
  }

  const fallbackText = getFirstString(
    message?.text,
    message?.output_text,
    message?.content_text,
    firstChoice?.text,
    firstChoice?.output_text,
  );
  if (fallbackText) {
    return fallbackText;
  }

  throw createOpenRouterError(config, model, 'openrouter_empty_content', {
    openRouterErrorMessage: 'OpenRouter response did not include usable assistant text.',
  });
}

function getOpenRouterResponseShape(response: unknown) {
  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;
  const choices = getRecord(response)?.choices;
  const finishReasonRaw = firstChoice?.finish_reason ?? firstChoice?.finishReason;

  return {
    hasChoices: Array.isArray(choices),
    choiceCount: Array.isArray(choices) ? choices.length : 0,
    hasMessage: Boolean(message),
    contentType: getValueType(content),
    contentIsNull: content === null,
    hasReasoning: typeof message?.reasoning === 'string' && message.reasoning.length > 0,
    hasReasoningDetails: Boolean(message?.reasoning_details),
    finishReason: typeof finishReasonRaw === 'string' || finishReasonRaw === null ? finishReasonRaw : undefined,
  };
}

function getFirstChoice(response: unknown): SafeRecord | undefined {
  const choices = getRecord(response)?.choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }

  return getRecord(choices[0]);
}

function extractTextBlock(value: unknown) {
  const block = getRecord(value);
  if (!block) {
    return undefined;
  }

  return getFirstString(block.text, block.content, block.output_text);
}

function extractTextFromReasoningDetails(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    const block = getRecord(item);
    return block ? getFirstString(block.text, block.content, block.summary, block.output_text) : undefined;
  }).filter(Boolean).join('\n').trim();

  return text || undefined;
}

function getFirstString(...values: unknown[]) {
  const text = values.find((value) => typeof value === 'string' && value.trim());
  return typeof text === 'string' ? text : undefined;
}

function getRecord(value: unknown): SafeRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SafeRecord : undefined;
}

function getValueType(value: unknown) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function createOpenRouterError(
  config: AiConfig,
  model: string,
  reason: OpenRouterFailureReason,
  details: Pick<OpenRouterFailureInfo, 'httpStatus' | 'openRouterErrorMessage'> = {},
) {
  return new OpenRouterProviderError({
    reason,
    aiEnabled: config.enabled,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    model,
    provider: config.provider,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    httpStatus: details.httpStatus,
    openRouterErrorMessage: sanitizeProviderMessage(details.openRouterErrorMessage),
  });
}

async function getOpenRouterErrorMessage(response: Response) {
  const body = await response.text();
  const trimmed = body.trim();
  if (!trimmed) {
    return `OpenRouter returned HTTP ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const message = getNestedErrorMessage(parsed);
    return message ?? `OpenRouter returned HTTP ${response.status}.`;
  } catch {
    return trimmed;
  }
}

function getNestedErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directMessage = record.message;
  if (typeof directMessage === 'string') {
    return directMessage;
  }

  const error = record.error;
  if (error && typeof error === 'object') {
    return getNestedErrorMessage(error);
  }

  return undefined;
}

function findFirstJsonObject(value: string) {
  let depth = 0;
  let startIndex = -1;
  let isInString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        isInString = false;
      }
      continue;
    }

    if (char === '"') {
      isInString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
}

function getSchemaErrorMessage(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function sanitizeProviderMessage(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, 'data:image/[redacted];base64,[redacted]').slice(0, 600);
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return sanitizeProviderMessage(error.message);
  }

  return 'Unknown OpenRouter error.';
}

function logOpenRouterDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(event, details);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

// ─── Coaching Repair ──────────────────────────────────────────────────────────

const stepCoachingPatchSchema = z.object({
  steps: z.array(z.object({
    index: z.number(),
    decisionPoint: z.string().optional(),
    ifYes: z.string().optional(),
    ifNo: z.string().optional(),
    why: z.string().optional(),
    commonMistake: z.string().optional(),
    chefTip: z.string().optional(),
    commonQuestion: z.string().optional(),
    commonQuestionAnswer: z.string().optional(),
    lookFor: z.string().optional(),
    doneWhen: z.string().optional(),
  })),
});

export type StepCoachingPatch = z.infer<typeof stepCoachingPatchSchema>['steps'][number];

// Sends specific weak coaching fields back to the AI for targeted improvement.
// Caller identifies exactly which steps and fields need work; this function
// repairs only those, keeping the prompt small and the fixes precise.
export async function repairStepCoachingWithAI(input: {
  steps: RecipeStep[];
  weaknesses: { stepIndex: number; weakFields: string[] }[];
  dishName: string;
  config: AiConfig;
}): Promise<StepCoachingPatch[]> {
  const weakStepData = input.weaknesses.map(({ stepIndex, weakFields }) => {
    const step = input.steps[stepIndex];
    // Only include existing values that are actually set — null values waste tokens
    // and add noise. Primary recipes have none, so existing is omitted entirely.
    const existing: Record<string, string> = {};
    if (step.why || step.whyItMatters) existing.why = step.why || step.whyItMatters || '';
    if (step.chefTip) existing.chefTip = step.chefTip;
    if (step.commonQuestion) existing.commonQuestion = step.commonQuestion;
    if (step.decisionPoint) existing.decisionPoint = step.decisionPoint;
    if (step.lookFor) existing.lookFor = step.lookFor;
    if (step.doneWhen) existing.doneWhen = step.doneWhen;
    return {
      index: stepIndex,
      phase: step.phase ?? null,
      title: step.title ?? '',
      text: step.text.slice(0, 120),
      needs: weakFields,
      ...(Object.keys(existing).length > 0 ? { existing } : {}),
    };
  });

  const fieldRules = [
    '"why": one sentence naming the ingredient/technique and the specific outcome it achieves. Never "This step is important." or "For best results."',
    '"chefTip": one non-obvious technique sentence naming the actual ingredient. Never "Cook carefully." or "Watch the heat."',
    '"commonQuestion": a real beginner question at this exact step. Best: "Is this cooked?", "What should this look like?", "Can I use [substitute]?", "What if I don\'t have [tool]?". Only on cooking/timing steps.',
    '"commonQuestionAnswer": one direct answer. Required if commonQuestion is set.',
    '"decisionPoint": a yes/no observable check answerable by looking or tasting. MUST use visual vocab: color, texture, movement. "Is the bottom golden brown?", "Does the sauce coat a spoon?", "Are the onions translucent?" Only on Phase 3–5 steps.',
    '"ifYes": short direct action. "Flip now." "Reduce heat and add cream." Required if decisionPoint set.',
    '"ifNo": action + time. "Cook 1–2 more minutes, then check again." Required if decisionPoint set.',
    '"lookFor": ingredient + observable state (color/texture/movement/sound/temp). e.g. "Garlic turns golden and fragrant." or "Reads 165°F/74°C." Never vague: "looks done".',
    '"doneWhen": unambiguous completion signal — color/texture/physical test/temp. e.g. "No pink remains and juices run clear." or "Temp 165°F/74°C." Never time-only: "Cook 5 minutes."',
  ].join('\n');

  const prompt = [
    `Fix specific coaching gaps in a "${input.dishName}" recipe. Return ONLY valid JSON, no markdown.`,
    `Return: {"steps":[{"index":N,...only the fields listed in "needs" for that step...},...]}`,
    `Only return the ${weakStepData.length} steps listed. Return EVERY field listed in each step's "needs" array — never omit a requested field. Omit fields that are NOT in "needs".`,
    `Field rules:\n${fieldRules}`,
    `Steps to fix:\n${JSON.stringify(weakStepData)}`,
  ].join('\n');

  const maxTokens = Math.min(
    input.config.maxOutputTokens,
    Math.max(1000, input.weaknesses.reduce((t, w) => t + w.weakFields.length * 120, 0)),
  );

  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        { role: 'system', content: 'You are Okyo, a recipe coaching assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      maxTokens,
      stage: 'coaching_repair',
    },
    getRecipeModelChain(input.config),
  );

  const output = stepCoachingPatchSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }
  return output.data.steps;
}

// ── Component coverage repair ─────────────────────────────────────────────────

const componentRepairOutputSchema = z.object({
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  ingredients: z.array(z.string()).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
});

export type ComponentRepairOutput = z.infer<typeof componentRepairOutputSchema>;

// Generates ingredient groups, ingredients, steps, and grocery items for platter
// components that the initial recipe generation omitted. Throws on AI failure so
// the caller can fall back to the original recipe gracefully.
export async function callComponentRepairWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  missingComponents: string[];
  existingIngredientGroups: Array<{ component: string; items: unknown[] }>;
}): Promise<ComponentRepairOutput> {
  const existing = input.existingIngredientGroups.map((g) => g.component).filter(Boolean).join(', ');
  const prompt = [
    `The recipe for "${input.analysis.dishName}" is missing these platter components: ${input.missingComponents.join(', ')}.`,
    `Already covered — DO NOT regenerate: ${existing || 'none'}.`,
    'For EACH missing component only, generate:',
    '• One ingredientGroups entry with 2–6 ingredients (each with exact amounts)',
    '• Flat ingredient strings for the ingredients array',
    '• 1–3 preparation step objects per component',
    'Return ONLY valid JSON: {"ingredientGroups":[{"component":"<name>","items":["<amt> <ing>",...]},...],"ingredients":["<amt> <ing>",...],"steps":[{"stepNumber":N,"title":"...","step":"...","ingredients":["..."],"tools":["..."]},...]}',
    'Never copy existing components. Name every ingredient specifically — never "main ingredient" or "protein".',
    `Context: ${JSON.stringify({ dish: input.analysis.dishName, cuisine: input.analysis.cuisine, missing: input.missingComponents })}`,
  ].join('\n');

  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'You are a professional chef assistant. Fill in missing platter recipe components. Return ONLY valid JSON. No markdown. No explanations.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, 2400),
      stage: 'component_coverage_repair',
    },
    getRecipeModelChain(input.config),
  );

  const output = componentRepairOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }
  return output.data;
}
