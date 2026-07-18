import { createHash } from 'node:crypto';
import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import { isQuotaError, type ProviderQuota } from '../quota/providerQuota.js';
import type { RecipeMode, RecipeStep, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';
import {
  canonicalIngredientName,
  findMatchingIngredientName,
  ingredientsMatch,
} from './recipeIngredientValidation.js';
import {
  RecipeGenerationError,
  RecipeValidationError,
} from './recipeGenerationError.js';
import { isGenuinePlatterMeal } from './recipePlatterValidation.js';
import {
  getRemainingScanMs,
  ScanCancelledError,
  ScanDeadlineExceededError,
  throwIfScanCancelled,
  waitForScanDelay,
  type ScanExecutionContext,
} from './scanDeadline.js';
import {
  logScanMetric,
  measureScanAggregateStage,
  recordLogicalProviderCall,
  recordProviderAttempt,
  recordRepairReasons,
  setScanRecipeContract,
} from '../telemetry/scanTelemetry.js';

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

const nutritionEstimateSchema = z.object({
  calories: z.number().nonnegative().max(5000).optional(),
  proteinGrams: z.number().nonnegative().max(500).optional(),
  carbohydratesGrams: z.number().nonnegative().max(1000).optional(),
  fatGrams: z.number().nonnegative().max(500).optional(),
}).optional();

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
  substitutions: z.union([
    z.string(),
    z.array(z.union([
      z.string(),
      z.record(z.unknown()).transform((obj) => {
        const r = obj as Record<string, unknown>;
        const from = String(r.ingredient ?? r.name ?? r.from ?? '');
        const to = String(r.substitute ?? r.replacement ?? r.to ?? '');
        const note = String(r.note ?? r.description ?? '');
        return [from && `${from}:`, to, note].filter(Boolean).join(' ').trim();
      }),
    ])),
  ]).optional().default([]).transform((value) => {
    if (Array.isArray(value)) return value;
    const substitution = value.trim();
    return substitution ? [substitution] : [];
  }),
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
  nutritionEstimate: nutritionEstimateSchema,
});

// One scan -> one canonical recipe. The AI returns a single recipe object
// (the dish plus its fields/steps), never per-mode variants. Budget/Healthy are
// computed view projections downstream, not separate generations.
export const openRouterRecipeOutputSchema = recipeVariantSchema.extend({
  dishName: z.string().optional().default(''),
});

const compactMinutesSchema = z.union([z.number(), z.string()]).transform((value) => {
  const parsed = typeof value === 'number' ? value : Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
}).pipe(z.number().int().min(0));

const compactRecipeStepSchema = z.object({
  instruction: z.string().min(1),
  doneWhen: z.string().optional().default(''),
  safetyNote: z.string().optional().default(''),
});

export const compactRecipeOutputSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
  equipment: z.array(z.string()).max(6).optional().default([]),
  steps: z.array(compactRecipeStepSchema).min(1),
  prepTime: compactMinutesSchema,
  cookTime: compactMinutesSchema,
  totalTime: compactMinutesSchema,
  servings: z.union([z.number(), z.string()]).transform((value) => {
    const parsed = typeof value === 'number' ? value : Number(value.match(/\d+/)?.[0]);
    return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
  }).pipe(z.number().int().min(1).max(12)),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  nutritionEstimate: nutritionEstimateSchema,
});

// The legacy full-array repair remains available only for validation defects
// that cannot be represented as indexed ingredient/step corrections.
const fullRecipeRepairStepSchema = z.object({
  // stepIndex is the canonical zero-based identifier. stepNumber is accepted
  // only as a provider compatibility input and converted from one-based.
  stepIndex: z.number().int().nonnegative().optional(),
  stepNumber: z.number().int().positive().optional(),
  title: z.string().optional().default(''),
  step: z.string().optional().default(''),
  instruction: z.string().optional().default(''),
  doneWhen: z.string().optional().default(''),
  safetyNote: z.string().optional().default(''),
}).strict().refine(
  (step) => Boolean(step.step.trim() || step.instruction.trim()),
  { message: 'A repaired step must include step or instruction text.' },
);

const fullRecipeIndexedStepCorrectionSchema = z.object({
  // Indexed repairs use zero-based indices exclusively. The exact sparse
  // contract prevents a model-authored full array from replacing valid steps.
  stepIndex: z.number().int().nonnegative(),
  title: z.string().optional(),
  step: z.string().optional(),
  instruction: z.string().optional(),
  doneWhen: z.string().optional(),
  safetyNote: z.string().optional(),
}).strict().refine(
  (step) => Boolean(step.step?.trim() || step.instruction?.trim()),
  { message: 'A corrected step must include step or instruction text.' },
);

const fullRecipeIngredientCorrectionSchema = z.object({
  ingredientIndex: z.number().int().nonnegative(),
  value: z.string().min(1),
}).strict();

const fullRecipeIndexedRepairPatchSchema = z.object({
  ingredientCorrections: z.array(fullRecipeIngredientCorrectionSchema).optional().default([]),
  stepCorrections: z.array(fullRecipeIndexedStepCorrectionSchema).optional().default([]),
}).strict().refine(
  (patch) => patch.ingredientCorrections.length + patch.stepCorrections.length > 0,
  { message: 'At least one indexed correction is required.' },
);

export type OpenRouterVisionOutput = z.input<typeof openRouterVisionOutputSchema>;
export type OpenRouterRecipeOutput = z.infer<typeof openRouterRecipeOutputSchema>;
export type OpenRouterRecipeVariant = z.infer<typeof recipeVariantSchema>;
export type CompactRecipeOutput = z.infer<typeof compactRecipeOutputSchema>;

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
  quota: ProviderQuota;
} & Partial<ScanExecutionContext>) {
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
    firstOutput = await callVisionOnce(
      input,
      getVisionPrompt(input.image, input.mode, input.config.compactRecipeEnabled),
      'vision',
    );
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
    logRetryMetric(input, 'vision_initial_retry', retryReason);
    await waitForScanDelay(3500, input.signal, input.deadlineAt);
    firstOutput = await callVisionOnce(
      input,
      getCompactVisionRetryPrompt(input.image, input.mode, input.config.compactRecipeEnabled),
      'vision_initial_retry',
    );
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
    ? getCompactVisionRetryPrompt(input.image, input.mode, input.config.compactRecipeEnabled)
    : getFocusedVisionRetryPrompt(
        input.image,
        input.mode,
        firstOutput,
        input.config.compactRecipeEnabled,
      );
  try {
    logRetryMetric(input, 'vision_quality_retry', retryReason ?? 'quality_retry');
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
    if (isQuotaError(error)) throw error;
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
  input: {
    config: AiConfig;
    image?: ScanImageMetadata;
    mode: RecipeMode;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  promptText: string,
  stage: string,
) {
  const content: OpenRouterContentPart[] = [{ type: 'text', text: promptText }];
  const imageUrl = getSafeImageUrl(input.image);
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  recordLogicalProviderCall(input.timing);
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
    quota: input.quota,
    requestId: input.requestId,
    signal: input.signal,
    deadlineAt: input.deadlineAt,
    timing: input.timing,
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
const RECIPE_CACHE_MAX_ENTRIES = 2000;

// Lazily sweeps expired entries and, if still oversized, drops the oldest
// (first-inserted) entries. Called on insert so the cache never needs its
// own timer/interval.
function sweepRecipeCache(): void {
  const now = Date.now();
  for (const [key, entry] of recipeCache) {
    if (entry.expiresAt <= now) {
      recipeCache.delete(key);
    }
  }
  if (recipeCache.size > RECIPE_CACHE_MAX_ENTRIES) {
    const overflow = recipeCache.size - RECIPE_CACHE_MAX_ENTRIES;
    const oldestKeys = [...recipeCache.keys()].slice(0, overflow);
    for (const key of oldestKeys) {
      recipeCache.delete(key);
    }
  }
}

// One-time-per-process warning when a paid fallback model is configured.
// Never enables it and never removes it — informational only.
let paidFallbackStartupWarningLogged = false;
export function validatePaidFallbackAtStartup(): void {
  const paid = process.env.RECIPE_PAID_FALLBACK_MODEL?.trim();
  if (paid && !paidFallbackStartupWarningLogged) {
    paidFallbackStartupWarningLogged = true;
    console.warn('[cost] RECIPE_PAID_FALLBACK_MODEL is set — recipe generation may fall back to a PAID model on failure:', paid);
  }
}

function getRecipeCacheKey(
  analysis: FoodImageAnalysis,
  mode: RecipeMode,
  compactRecipeEnabled: boolean,
): string {
  const data = JSON.stringify({
    d: analysis.dishName.trim().toLowerCase(),
    i: [...analysis.visibleIngredients].sort().map((s) => s.trim().toLowerCase()),
    m: compactRecipeEnabled ? 'canonical' : mode,
    c: analysis.broadDishCategory.trim().toLowerCase(),
    contract: compactRecipeEnabled ? 'compact-v1' : 'full-core-v2',
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

function storeRecipeCache(
  key: string,
  recipe: OpenRouterRecipeOutput,
  dish: string,
  options: { addImagePrompts?: boolean } = {},
): OpenRouterRecipeOutput {
  const processed = options.addImagePrompts === false ? recipe : addStepImagePrompts(recipe, dish);
  recipeCache.set(key, { recipe: processed, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
  sweepRecipeCache();
  logOpenRouterDebug('recipe_cache_store', { key: key.slice(0, 8), dish });
  return processed;
}

function getRecipeModelChain(config: AiConfig): string[] {
  // Fail-closed: Fable 5 never silently falls back to the cheap Gemini chain
  // (or a paid fallback) on failure. If it fails, the scan fails — no
  // cross-provider/cross-model downgrade happens without the user knowing.
  if (config.isFableActive) {
    return [config.openRouterTextModel];
  }

  const models = [config.openRouterTextModel, ...RECIPE_FALLBACK_MODELS];
  const paid = process.env.RECIPE_PAID_FALLBACK_MODEL?.trim();
  if (paid) {
    console.warn('[cost] paid fallback model is in this request\'s chain (last resort):', paid);
    models.push(paid);
  }
  return [...new Set(models)];
}

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode?: RecipeMode;
  quota: ProviderQuota;
} & Partial<ScanExecutionContext>) {
  const mode: RecipeMode = input.mode ?? 'Restaurant Copy';
  setScanRecipeContract(
    input.timing,
    input.config.compactRecipeEnabled ? 'compact-v1' : 'full-core-v2',
  );

  // Cache check skips recipe generation entirely on a hit.
  const cacheKey = getRecipeCacheKey(input.analysis, mode, input.config.compactRecipeEnabled);
  const cached = recipeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logOpenRouterDebug('recipe_cache_hit', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });
    return cached.recipe;
  }
  logOpenRouterDebug('recipe_cache_miss', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });

  if (input.config.compactRecipeEnabled) {
    return generateCompactRecipeWithOpenRouter(input, cacheKey);
  }

  // Epicure and all optional enrichment are deferred until after the initial
  // scan response. The blocking recipe call receives dish evidence only.
  const recipePrompt = getRecipePrompt(input.analysis, mode);
  const fullPromptChars = recipePrompt.length;
  console.log('[recipe_contract_size]', {
    requestId: input.requestId,
    dish: input.analysis.dishName,
    mode,
    contract: 'full-core-v2',
    promptChars: fullPromptChars,
    estimatedPromptTokens: Math.ceil(fullPromptChars / 4),
    maxOutputTokens: getFullRecipeMaxTokens(input.analysis, input.config.maxOutputTokens),
  });

  const isDrink = isDrinkAnalysisText([
    input.analysis.dishName,
    input.analysis.broadDishCategory,
    ...input.analysis.visibleIngredients,
    ...input.analysis.likelyIngredients,
  ].join(' '));

  let firstOutput: OpenRouterRecipeOutput | undefined;
  try {
    firstOutput = await measureScanAggregateStage({
      timing: input.timing,
      stage: 'recipe',
      run: () => callRecipeStage(
        input,
        recipePrompt,
        getFullRecipeMaxTokens(input.analysis, input.config.maxOutputTokens),
        'recipe',
      ),
    });
  } catch (firstError) {
    if (isQuotaError(firstError) || isScanControlError(firstError)) throw firstError;
    if (!isRepairableRecipeOutputError(firstError)) {
      throw new RecipeGenerationError(
        firstError instanceof OpenRouterProviderError ? firstError.failure.reason : 'provider_failed',
      );
    }
    const reason = firstError instanceof OpenRouterProviderError
      ? firstError.failure.reason
      : 'provider_output_unavailable';
    logRetryMetric(input, 'recipe_repair', reason);
    return repairFullRecipe(input, cacheKey, undefined, [reason], isDrink);
  }

  const normalizationBeforeDeterministicFixes = normalizeFullRecipeOutputWithDiagnostics(
    firstOutput,
    input.analysis,
    { applyDeterministicSafety: false },
  );
  const issuesBeforeDeterministicFixes = validateFullRecipeOutput(
    normalizationBeforeDeterministicFixes.output,
    input.analysis,
    isDrink,
  );
  const initialNormalization = normalizeFullRecipeOutputWithDiagnostics(
    normalizationBeforeDeterministicFixes.output,
    input.analysis,
  );
  const normalized = initialNormalization.output;
  const issues = validateFullRecipeOutput(normalized, input.analysis, isDrink);
  const deterministicFixContext: FullRecipeDeterministicFixContext = {
    issuesBeforeDeterministicFixes,
    deterministicFixesApplied: [...new Set([
      ...normalizationBeforeDeterministicFixes.diagnostics.deterministicFixesApplied,
      ...initialNormalization.diagnostics.deterministicFixesApplied,
    ])],
    issuesAfterDeterministicFixes: issues,
  };
  const initialDecision = classifyFullRecipeIssues(issues);
  const nonRepairableFatalIssues = initialDecision.fatalIssues.filter(
    (issue) => issue !== 'step_uses_unlisted_ingredients',
  );
  const hasIndexedRepairIssue = initialDecision.repairableIssues.length > 0 ||
    initialDecision.fatalIssues.includes('step_uses_unlisted_ingredients');
  console.log('[recipe_deterministic_fixes]', {
    requestId: input.requestId,
    ...deterministicFixContext,
    selectedRepairMode: nonRepairableFatalIssues.length === 0 && hasIndexedRepairIssue
      ? 'indexed'
      : 'none',
  });
  if (initialDecision.fatalIssues.length === 0 && initialDecision.repairableIssues.length === 0) {
    console.log('[recipe_repair_outcome]', {
      requestId: input.requestId,
      selectedRepairMode: 'none',
      finalFailureReasons: [],
    });
    logScanRecipeDecision(input, {
      initialIssues: issuesBeforeDeterministicFixes,
      deterministicFixesApplied: deterministicFixContext.deterministicFixesApplied,
      ...initialDecision,
      repairAttempted: false,
      repairSucceeded: false,
      returnedOriginalSafeRecipe: false,
      finalDecision: 'success',
      finalFailureReasons: [],
    });
    return storeRecipeCache(cacheKey, normalized, input.analysis.dishName, { addImagePrompts: false });
  }

  if (nonRepairableFatalIssues.length > 0) {
    logScanRecipeDecision(input, {
      initialIssues: issuesBeforeDeterministicFixes,
      deterministicFixesApplied: deterministicFixContext.deterministicFixesApplied,
      ...initialDecision,
      repairAttempted: false,
      repairSucceeded: false,
      returnedOriginalSafeRecipe: false,
      finalDecision: 'failure',
      finalFailureReasons: nonRepairableFatalIssues,
    });
    throw new RecipeValidationError(nonRepairableFatalIssues);
  }

  const repairIssues = issues.filter((issue) => indexedFullRecipeRepairIssues.has(issue));

  logFullRecipeValidationDetails(input, normalized, repairIssues);
  logRetryMetric(input, 'recipe_repair', repairIssues.join(','));
  return repairFullRecipe(
    input,
    cacheKey,
    normalized,
    repairIssues,
    isDrink,
    initialNormalization.diagnostics,
    deterministicFixContext,
    initialDecision,
  );
}

async function repairFullRecipe(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  cacheKey: string,
  previousOutput: OpenRouterRecipeOutput | undefined,
  issues: string[],
  isDrink: boolean,
  initialNormalizationDiagnostics?: FullRecipeNormalizationDiagnostics,
  deterministicFixContext?: FullRecipeDeterministicFixContext,
  initialDecision?: FullRecipeIssueDecision,
): Promise<OpenRouterRecipeOutput> {
  throwIfScanCancelled(input.signal, input.deadlineAt);
  const selectedRepairMode = selectFullRecipeRepairMode(previousOutput, issues);
  const issueDecision = initialDecision ?? classifyFullRecipeIssues(issues);
  console.log('[recipe_repair_mode]', {
    requestId: input.requestId,
    selectedRepairMode,
    initialIssues: issues,
    issuesBeforeDeterministicFixes:
      deterministicFixContext?.issuesBeforeDeterministicFixes ?? issues,
    deterministicFixesApplied:
      deterministicFixContext?.deterministicFixesApplied ?? [],
    issuesAfterDeterministicFixes:
      deterministicFixContext?.issuesAfterDeterministicFixes ?? issues,
  });
  let repairWarnings: string[] = [];
  try {
    const normalized = await measureScanAggregateStage({
      timing: input.timing,
      stage: 'repair',
      run: async () => {
        const repairJson = await callRecipeRepairStage(
          input,
          getFullRecipeRepairPrompt(
            input.analysis,
            previousOutput,
            issues,
            selectedRepairMode,
          ),
          getFullRecipeMaxTokens(input.analysis, input.config.maxOutputTokens),
          'recipe_repair',
        );
        if (previousOutput) {
          const application = applyFullRecipeRepairPatch(
            input,
            previousOutput,
            repairJson,
            issues,
            isDrink,
            selectedRepairMode,
            initialNormalizationDiagnostics,
          );
          repairWarnings = application.warnings;
          return application.output;
        }
        const repaired = openRouterRecipeOutputSchema.safeParse(repairJson);
        if (!repaired.success) {
          throw new RecipeValidationError(['repair_invalid_schema']);
        }
        const normalizedRepair = normalizeFullRecipeOutput(repaired.data, input.analysis);
        const repairDiagnostics = getFullRecipeRepairDiagnostics(
          normalizedRepair,
          input.analysis,
        );
        logFullRecipeRepairValidation(input, {
          initialInvalidStepIndices: [],
          repairedInvalidStepIndices: repairDiagnostics.stepsMissingCompletionCue,
          unknownIngredientsBeforeRepair: [],
          unknownIngredientsAfterRepair: repairDiagnostics.unknownIngredients,
          presentationOnlyStepIndices: repairDiagnostics.presentationOnlyStepIndices,
          repairChangedFields: ['entire_recipe'],
        });
        return normalizedRepair;
      },
    });
    const remainingIssues = validateFullRecipeOutput(normalized, input.analysis, isDrink);
    const remainingDecision = classifyFullRecipeIssues(remainingIssues);
    if (remainingDecision.fatalIssues.length > 0 ||
      remainingDecision.repairableIssues.length > 0) {
      throw new RecipeValidationError(remainingIssues);
    }
    console.log('[recipe_repair_outcome]', {
      requestId: input.requestId,
      selectedRepairMode,
      finalFailureReasons: [],
    });
    logScanRecipeDecision(input, {
      initialIssues: deterministicFixContext?.issuesBeforeDeterministicFixes ?? issues,
      deterministicFixesApplied: deterministicFixContext?.deterministicFixesApplied ?? [],
      ...issueDecision,
      warnings: [...new Set([
        ...issueDecision.warnings,
        ...remainingDecision.warnings,
        ...repairWarnings,
      ])],
      repairAttempted: true,
      repairSucceeded: true,
      returnedOriginalSafeRecipe: false,
      finalDecision: 'success',
      finalFailureReasons: [],
    });
    return storeRecipeCache(
      cacheKey,
      normalized,
      input.analysis.dishName,
      { addImagePrompts: false },
    );
  } catch (error) {
    const finalFailureReasons = error instanceof RecipeValidationError
      ? error.issues
      : [
          ...issues,
          error instanceof OpenRouterProviderError
            ? error.failure.reason
            : 'repair_output_unavailable',
        ];
    console.log('[recipe_repair_outcome]', {
      requestId: input.requestId,
      selectedRepairMode,
      finalFailureReasons,
    });

    if (previousOutput && !isQuotaError(error) && !isScanControlError(error)) {
      const fallbackNormalization = normalizeFullRecipeOutputWithDiagnostics(
        previousOutput,
        input.analysis,
      );
      const fallbackIssues = validateFullRecipeOutput(
        fallbackNormalization.output,
        input.analysis,
        isDrink,
      );
      const fallbackDecision = classifyFullRecipeIssues(fallbackIssues);
      if (fallbackDecision.fatalIssues.length === 0) {
        logScanRecipeDecision(input, {
          initialIssues: deterministicFixContext?.issuesBeforeDeterministicFixes ?? issues,
          deterministicFixesApplied: deterministicFixContext?.deterministicFixesApplied ?? [],
          ...issueDecision,
          warnings: [...new Set([
            ...issueDecision.warnings,
            ...repairWarnings,
            ...finalFailureReasons,
          ])],
          repairAttempted: true,
          repairSucceeded: false,
          returnedOriginalSafeRecipe: true,
          finalDecision: 'safe_fallback',
          finalFailureReasons: [],
        });
        return storeRecipeCache(
          cacheKey,
          fallbackNormalization.output,
          input.analysis.dishName,
          { addImagePrompts: false },
        );
      }
    }

    const failureDecision = previousOutput
      ? classifyFullRecipeIssues(validateFullRecipeOutput(previousOutput, input.analysis, isDrink))
      : issueDecision;
    const stableFinalFailureReasons = failureDecision.fatalIssues.length > 0
      ? failureDecision.fatalIssues
      : finalFailureReasons;
    logScanRecipeDecision(input, {
      initialIssues: deterministicFixContext?.issuesBeforeDeterministicFixes ?? issues,
      deterministicFixesApplied: deterministicFixContext?.deterministicFixesApplied ?? [],
      ...issueDecision,
      warnings: [...new Set([...issueDecision.warnings, ...repairWarnings])],
      repairAttempted: true,
      repairSucceeded: false,
      returnedOriginalSafeRecipe: false,
      finalDecision: 'failure',
      finalFailureReasons: stableFinalFailureReasons,
    });
    if (isQuotaError(error) || isScanControlError(error)) throw error;
    throw new RecipeValidationError(stableFinalFailureReasons);
  }
}

type FullRecipeNormalizationDiagnostics = {
  aliasMatchesApplied: string[];
  suppressedNestedIngredientMentions: string[];
  unresolvedIngredientMentions: string[];
  deterministicSafetyApplied: boolean;
  deterministicFixesApplied: string[];
};

type FullRecipeDeterministicFixContext = {
  issuesBeforeDeterministicFixes: string[];
  deterministicFixesApplied: string[];
  issuesAfterDeterministicFixes: string[];
};

type FullRecipeIssueDecision = {
  fatalIssues: string[];
  repairableIssues: string[];
  warnings: string[];
};

type ScanRecipeDecision = FullRecipeIssueDecision & {
  initialIssues: string[];
  deterministicFixesApplied: string[];
  repairAttempted: boolean;
  repairSucceeded: boolean;
  returnedOriginalSafeRecipe: boolean;
  finalDecision: 'success' | 'safe_fallback' | 'failure';
  finalFailureReasons: string[];
};

const repairableFullRecipeIssues = new Set([
  'ingredients_missing_amounts',
  'step_missing_time_or_completion_cue',
]);

const warningFullRecipeIssues = new Set([
  'too_many_steps',
  'step_count_above_preferred',
  'optional_metadata_missing',
]);

function classifyFullRecipeIssues(issues: string[]): FullRecipeIssueDecision {
  const uniqueIssues = [...new Set(issues)];
  return {
    fatalIssues: uniqueIssues.filter((issue) =>
      !repairableFullRecipeIssues.has(issue) && !warningFullRecipeIssues.has(issue)),
    repairableIssues: uniqueIssues.filter((issue) => repairableFullRecipeIssues.has(issue)),
    warnings: uniqueIssues.filter((issue) => warningFullRecipeIssues.has(issue)),
  };
}

function logScanRecipeDecision(
  input: Partial<ScanExecutionContext>,
  decision: ScanRecipeDecision,
): void {
  console.log('[scan_recipe_decision]', {
    requestId: input.requestId,
    ...decision,
  });
}

function normalizeFullRecipeOutputWithDiagnostics(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
  options: { applyDeterministicSafety?: boolean } = {},
): { output: OpenRouterRecipeOutput; diagnostics: FullRecipeNormalizationDiagnostics } {
  const ingredientNormalization = normalizeProviderIngredientListWithDiagnostics(output.ingredients);
  const ingredientNames = ingredientNormalization.ingredients;
  const equipment = output.equipment
    .map((tool) => typeof tool === 'string' ? tool.trim() : '')
    .filter(Boolean);
  const preparedSteps = output.steps.map((rawStep) => {
    const record: SafeRecord = typeof rawStep === 'object' && rawStep ? rawStep : {};
    const instruction = getProviderStepText(rawStep).trim();
    return {
      title: typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : deriveProviderStepTitle(instruction),
      step: instruction,
      doneWhen: typeof record.doneWhen === 'string' && record.doneWhen.trim()
        ? record.doneWhen.trim()
        : undefined,
      safetyNote: typeof record.safetyNote === 'string' && record.safetyNote.trim()
        ? record.safetyNote.trim()
        : undefined,
    };
  });
  // Resolve full ingredient phrases before deriving per-step metadata so a
  // listed concept such as "sweet rice flour" shadows nested "rice"/"flour".
  const mentionDiagnostics = getIngredientMentionDiagnostics(
    preparedSteps.map((step) => step.step),
    ingredientNames,
  );
  const safety = options.applyDeterministicSafety === false
    ? { steps: preparedSteps, applied: false, fixesApplied: [] }
    : applyDeterministicRecipeSafety(preparedSteps, analysis, ingredientNames);
  let lastPhase = 1;
  const steps = safety.steps.map((step, index) => {
    const instruction = step.step;
    // Per-step references are always derived from the final canonical lists.
    // Provider arrays are optional metadata and must never create a closure
    // failure or survive a targeted repair unchanged.
    const normalizedIngredients = ingredientNames
      .filter((ingredient) => instructionUsesIngredient(instruction, ingredient))
      .map(canonicalIngredientName);
    const normalizedTools = equipment.filter((tool) =>
      instruction.toLowerCase().includes(tool.toLowerCase()));
    const derivedPhase = deriveProviderStepPhase(instruction, index, safety.steps.length);
    const phase = Math.max(lastPhase, derivedPhase);
    lastPhase = phase;

    return {
      stepNumber: index + 1,
      phase,
      title: step.title,
      step: instruction,
      ingredients: [...new Set(normalizedIngredients.filter(Boolean))],
      tools: [...new Set(normalizedTools.filter(Boolean))],
      doneWhen: step.doneWhen,
      safetyNote: step.safetyNote,
    };
  });

  const normalized = openRouterRecipeOutputSchema.parse({
    ...output,
    ingredients: ingredientNames,
    description: '',
    avoidMistake: '',
    mistakeWarning: '',
    storageAndReheating: '',
    storage: '',
    ingredientGroups: isGenuinePlatterMeal(analysis) ? output.ingredientGroups : [],
    groceryItems: [],
    spicePairings: [],
    substitutions: [],
    cookingTerms: [],
    steps,
  });
  return {
    output: normalized,
    diagnostics: {
      ...mentionDiagnostics,
      deterministicSafetyApplied: safety.applied,
      deterministicFixesApplied: [
        ...ingredientNormalization.fixesApplied,
        ...safety.fixesApplied,
      ],
    },
  };
}

export function normalizeFullRecipeOutput(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  return normalizeFullRecipeOutputWithDiagnostics(output, analysis).output;
}

function normalizeProviderIngredientList(ingredients: string[]): string[] {
  return normalizeProviderIngredientListWithDiagnostics(ingredients).ingredients;
}

function normalizeProviderIngredientListWithDiagnostics(
  ingredients: string[],
): { ingredients: string[]; fixesApplied: string[] } {
  const fixesApplied: string[] = [];
  const normalized = ingredients
    .map((ingredient, index) => {
      if (typeof ingredient !== 'string') return '';
      const trimmed = ingredient.trim()
        .replace(/^~\s*/i, '')
        .replace(/^(?:about|approximately|approx\.?)\s+/i, '');
      const trailingAmount = trimmed.match(
        /^(.+?)(?:\s*[,;–—-]\s*|\s*\()(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\s+((?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|cloves?|slices?|cans?|bunches?|pieces?|packages?)\b[^)]*)\)?$/i,
      );
      if (!trailingAmount) return trimmed;
      fixesApplied.push(`normalized_ingredient_amount_format:${index}`);
      return `${trailingAmount[2]} ${trailingAmount[3]} ${trailingAmount[1]}`
        .replace(/\s+/g, ' ')
        .trim();
    })
    .filter(Boolean);
  return { ingredients: normalized, fixesApplied };
}

function validateFullRecipeOutput(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
  isDrink: boolean,
): string[] {
  const issues = [
    ...validateRecipeStructure(output, analysis),
    ...getRecipeQualityIssues(output, analysis, isDrink),
  ];
  const safetyRequirement = getRecipeSafetyRequirement(
    analysis,
    output.ingredients,
    output.steps,
  );
  const safetyText = output.steps.map((step) => {
    if (typeof step === 'string') return step;
    return `${getProviderStepText(step)} ${step.safetyNote ?? ''}`;
  }).join(' ');
  if (safetyRequirement && hasUnsafeRequiredFoodTemperature(output.steps, safetyRequirement)) {
    issues.push(`unsafe_temperature_${safetyRequirement.code}`);
  }
  if (safetyRequirement && !safetyRequirement.pattern.test(safetyText)) {
    issues.push(`missing_safety_${safetyRequirement.code}`);
  }
  if (isGenuinePlatterMeal(analysis)) {
    const coverage = getRecipeComponentCoverage(
      (analysis.detectedComponents ?? []).map((component) => component.name),
      [
        output.title,
        ...output.ingredients.map(canonicalIngredientName),
        ...output.steps.map(getProviderStepText),
      ],
    );
    if (coverage.coveragePercent < 90) issues.push('platter_coverage_below_90');
  }
  return [...new Set(issues)];
}

type ProviderStepLike = string | {
  step?: string;
  instruction?: string;
  text?: string;
  doneWhen?: string;
  title?: string;
  safetyNote?: string;
};

function getProviderStepText(value: ProviderStepLike | undefined): string {
  if (typeof value === 'string') return value;
  return value?.step || value?.instruction || value?.text || '';
}

function deriveProviderStepTitle(instruction: string): string {
  const words = instruction
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 3);
  return words.length > 0
    ? words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Cooking Step';
}

function deriveProviderStepPhase(instruction: string, index: number, total: number): number {
  const normalized = instruction.toLowerCase();
  if (index === total - 1 && /\b(serve|plate|pour|enjoy)\b/.test(normalized)) return 6;
  if (/\b(garnish|finish|drizzle|sprinkle)\b/.test(normalized)) return 5;
  if (/\b(assemble|layer|fill|wrap|fold|toss|combine)\b/.test(normalized)) return 4;
  if (/\b(sear|fry|roast|bake|boil|grill|simmer|saute|sauté|steam|poach|braise|brown|reduce|cook)\b/.test(normalized)) return 3;
  if (/\b(preheat|heat|bring .* to a boil)\b/.test(normalized)) return 2;
  return index === 0 ? 1 : 3;
}

async function generateCompactRecipeWithOpenRouter(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    mode?: RecipeMode;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  cacheKey: string,
): Promise<OpenRouterRecipeOutput> {
  const prompt = getCompactRecipePrompt(input.analysis);
  const maxOutputTokens = getCompactRecipeMaxTokens(
    input.analysis,
    input.config.maxOutputTokens,
  );
  console.log('[recipe_contract_size]', {
    requestId: input.requestId,
    contract: 'compact-v1',
    promptChars: prompt.length,
    estimatedPromptTokens: Math.ceil(prompt.length / 4),
    maxOutputTokens,
  });

  let firstJson: unknown;
  try {
    firstJson = await measureScanAggregateStage({
      timing: input.timing,
      stage: 'recipe',
      run: () => callCompactRecipeJson(input, prompt, 'compact_recipe', maxOutputTokens),
    });
  } catch (error) {
    if (isQuotaError(error) || isScanControlError(error)) throw error;
    if (!isRepairableRecipeOutputError(error)) {
      throw new RecipeGenerationError(
        error instanceof OpenRouterProviderError ? error.failure.reason : 'provider_failed',
      );
    }
    logRetryMetric(
      input,
      'compact_recipe_repair',
      error instanceof OpenRouterProviderError ? error.failure.reason : 'provider_output_unavailable',
    );
    return repairCompactRecipe(input, cacheKey, undefined, [
      error instanceof OpenRouterProviderError ? error.failure.reason : 'provider_output_unavailable',
    ]);
  }

  const firstParsed = compactRecipeOutputSchema.safeParse(firstJson);
  let normalized: ReturnType<typeof normalizeCompactProviderOutput> | undefined;
  let firstIssues: string[];
  if (firstParsed.success) {
    normalized = normalizeCompactProviderOutput(firstParsed.data, input.analysis);
    firstIssues = validateCompactRecipeOutput(normalized.compact, input.analysis);
  } else {
    firstIssues = getCompactSchemaIssues(firstParsed.error);
  }
  if (normalized && firstIssues.length === 0) {
    return storeRecipeCache(
      cacheKey,
      normalized.canonical,
      input.analysis.dishName,
      { addImagePrompts: false },
    );
  }

  logRetryMetric(input, 'compact_recipe_repair', firstIssues.join(','));
  return repairCompactRecipe(input, cacheKey, firstJson, firstIssues);
}

async function repairCompactRecipe(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    mode?: RecipeMode;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  cacheKey: string,
  previousOutput: unknown,
  issues: string[],
): Promise<OpenRouterRecipeOutput> {
  throwIfScanCancelled(input.signal, input.deadlineAt);
  let repairJson: unknown;
  try {
    repairJson = await measureScanAggregateStage({
      timing: input.timing,
      stage: 'repair',
      run: () => callCompactRecipeJson(
        input,
        getCompactRecipeRepairPrompt(input.analysis, previousOutput, issues),
        'compact_recipe_repair',
        getCompactRecipeMaxTokens(input.analysis, input.config.maxOutputTokens),
      ),
    });
  } catch (error) {
    if (isQuotaError(error) || isScanControlError(error)) throw error;
    throw new RecipeValidationError([
      ...issues,
      error instanceof OpenRouterProviderError ? error.failure.reason : 'repair_output_unavailable',
    ]);
  }
  const repaired = compactRecipeOutputSchema.safeParse(repairJson);
  if (!repaired.success) {
    throw new RecipeValidationError(getCompactSchemaIssues(repaired.error));
  }

  const normalized = normalizeCompactProviderOutput(repaired.data, input.analysis);
  const remainingIssues = validateCompactRecipeOutput(normalized.compact, input.analysis);
  if (remainingIssues.length > 0) {
    throw new RecipeValidationError(remainingIssues);
  }

  return storeRecipeCache(
    cacheKey,
    normalized.canonical,
    input.analysis.dishName,
    { addImagePrompts: false },
  );
}

async function callCompactRecipeJson(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  prompt: string,
  stage: string,
  maxTokens: number,
): Promise<unknown> {
  return callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: [
            'You are Okyo, a cautious professional chef generating one canonical home-cook recipe.',
            'Return only valid JSON. Never return variants, markdown, explanations, step numbers, phases, per-step ingredient arrays, or per-step tool arrays.',
            'Food detection has already happened. Preserve the identified dish and cover every visible platter component.',
          ].join(' '),
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
      stage,
      quota: input.quota,
      requestId: input.requestId,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
      timing: input.timing,
    },
    getRecipeModelChain(input.config),
  );
}

export function getCompactRecipePrompt(analysis: FoodImageAnalysis): string {
  const isPlatter = isGenuinePlatterMeal(analysis);
  const isDrink = isDrinkAnalysisText([
    analysis.dishName,
    analysis.broadDishCategory,
    ...analysis.visibleIngredients,
  ].join(' '));
  return [
    `Create one realistic inspired-by home recipe for "${analysis.dishName}".`,
    'Return ONLY one minified JSON object with exactly these keys:',
    '{"title":"...","ingredients":["exact quantity ingredient"],"equipment":["..."],"steps":[{"instruction":"...","doneWhen":"optional sensory completion cue","safetyNote":"required only for food-safety hazards"}],"prepTime":10,"cookTime":20,"totalTime":30,"servings":2,"difficulty":"Easy|Medium|Hard","nutritionEstimate":{"calories":500,"proteinGrams":25,"carbohydratesGrams":55,"fatGrams":20}}',
    'Nutrition must be a cautious per-serving estimate derived from the listed quantities, using rounded numbers rather than a verified claim.',
    'Do not add description, substitutions, tips, explanations, questions, decision branches, cooking terms, spice pairings, flavor boosts, grocery items, image prompts, prices, storage, sharing copy, modes, or variants.',
    'Every ingredient must begin with a usable exact quantity. "Some", "as needed", or a bare ingredient name is invalid. "To taste" is allowed only for salt, pepper, acid, or hot sauce.',
    'Every ingredient named in a step must appear in the ingredient list. Unmeasured tap water used only to boil, rinse, wash, or make an ice bath may be omitted; measured water used in the food must be listed.',
    'Choose one coherent strategy: either shortcut ingredients or from-scratch ingredients, never both. Never list the finished dish as an ingredient.',
    isDrink
      ? 'Use 3-6 concise drink steps.'
      : isPlatter
        ? 'Use enough concise steps to cook every component; more than 8 is allowed only when coverage requires it.'
        : 'Use 5-8 concise steps for a normal cooked dish. Plain whole foods may use 2-5 steps.',
    'Each instruction must be directly cookable and contain a time, an observable sensory completion cue, or both. Name actual ingredients and actions; never say "cook until done", "prepare ingredients", or "mix everything".',
    'doneWhen is optional and should appear only when it adds a useful color, texture, temperature, or doneness check.',
    'Safety is mandatory: poultry 165°F/74°C; ground meat 160°F/71°C; pork and cooked fish 145°F/63°C. Raw-fish dishes must specify sushi-grade or previously frozen fish kept cold. Put the applicable rule in safetyNote on the relevant step.',
    isPlatter
      ? `Name and cook every detected component in the ingredients and steps. Required components: ${(analysis.detectedComponents ?? []).map((component) => component.name.trim()).filter(Boolean).slice(0, 12).join(', ') || 'every distinct visible component'}.`
      : '',
    'Keep equipment compact: only tools genuinely required.',
    `Dish evidence: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      category: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
      writtenFoodIdea: analysis.foodIdea,
    })}`,
  ].join('\n');
}

export function getRecipePromptSizeComparison(analysis: FoodImageAnalysis): {
  fullPromptChars: number;
  compactPromptChars: number;
  estimatedFullPromptTokens: number;
  estimatedCompactPromptTokens: number;
} {
  const fullPromptChars = getRecipePrompt(analysis, 'Restaurant Copy').length;
  const compactPromptChars = getCompactRecipePrompt(analysis).length;
  return {
    fullPromptChars,
    compactPromptChars,
    estimatedFullPromptTokens: Math.ceil(fullPromptChars / 4),
    estimatedCompactPromptTokens: Math.ceil(compactPromptChars / 4),
  };
}

function getCompactRecipeRepairPrompt(
  analysis: FoodImageAnalysis,
  previousOutput: unknown,
  issues: string[],
): string {
  const bounds = getRecipeStepBounds(analysis);
  return [
    `Correct the previous compact recipe for "${analysis.dishName}".`,
    `Critical defects: ${issues.join(', ')}.`,
    'Return ONLY the entire corrected compact recipe object. Never return a partial patch.',
    'Required keys: title, ingredients, equipment, steps, prepTime, cookTime, totalTime, servings, difficulty, nutritionEstimate.',
    'The same compact rules still apply: exact ingredient quantities; cookable instructions with time or sensory completion; required safetyNote; complete platter coverage.',
    `Return ${bounds.min}-${bounds.max} steps for this dish.`,
    `Full canonical ingredient list from the previous object: ${JSON.stringify(getRecord(previousOutput)?.ingredients ?? [])}`,
    `Previous output: ${JSON.stringify(previousOutput ?? {})}`,
    `Dish evidence: ${JSON.stringify({
      dishName: analysis.dishName,
      category: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      components: (analysis.detectedComponents ?? []).map((component) => component.name),
    })}`,
  ].join('\n');
}

function normalizeCompactRecipeTimes(output: CompactRecipeOutput): CompactRecipeOutput {
  const prepTime = Math.max(0, output.prepTime);
  const cookTime = Math.max(0, output.cookTime);
  const calculatedTotal = prepTime + cookTime;
  return {
    ...output,
    prepTime,
    cookTime,
    totalTime: calculatedTotal > 0 ? calculatedTotal : Math.max(1, output.totalTime),
    equipment: [...new Set(output.equipment.map((item) => item.trim()).filter(Boolean))].slice(0, 6),
  };
}

function normalizeCompactProviderOutput(
  output: CompactRecipeOutput,
  analysis: FoodImageAnalysis,
) {
  const compact = normalizeCompactRecipeTimes(output);
  return {
    compact,
    // Both recipe contracts derive canonical step metadata before the repair
    // decision. Compact validation still evaluates its smaller content contract.
    canonical: normalizeFullRecipeOutput(
      compactRecipeToCanonicalOutput(compact),
      analysis,
    ),
  };
}

function compactRecipeToCanonicalOutput(output: CompactRecipeOutput): OpenRouterRecipeOutput {
  return openRouterRecipeOutputSchema.parse({
    title: output.title,
    ingredients: output.ingredients,
    equipment: output.equipment,
    steps: output.steps.map((step) => ({
      step: step.instruction,
      doneWhen: step.doneWhen || undefined,
      safetyNote: step.safetyNote || undefined,
    })),
    prepTime: output.prepTime,
    cookTime: output.cookTime,
    totalTime: output.totalTime,
    activeTime: output.prepTime + Math.min(output.cookTime, 10),
    servings: output.servings,
    difficulty: output.difficulty,
    skillLevel: output.difficulty,
    nutritionEstimate: output.nutritionEstimate,
  });
}

function getRecipeStepBounds(analysis: FoodImageAnalysis): { min: number; max: number } {
  const text = `${analysis.dishName} ${analysis.broadDishCategory}`.toLowerCase();
  if (isGenuinePlatterMeal(analysis)) return { min: 5, max: 14 };
  if (isDrinkAnalysisText(text) || /\b(sushi|sashimi|ceviche|raw fish)\b/.test(text)) {
    return { min: 3, max: 6 };
  }
  if (isGenuinelySimpleRecipe(analysis)) return { min: 2, max: 5 };
  if (/\b(salad|sandwich|wrap|toast|snack|parfait|overnight oats)\b/.test(text)) {
    return { min: 3, max: 6 };
  }
  return { min: 5, max: 8 };
}

function getFullRecipeMaxTokens(analysis: FoodImageAnalysis, configuredLimit: number): number {
  return Math.min(configuredLimit, isGenuinePlatterMeal(analysis) ? 2000 : 1400);
}

function getCompactRecipeMaxTokens(analysis: FoodImageAnalysis, configuredLimit: number): number {
  return Math.min(configuredLimit, isGenuinePlatterMeal(analysis) ? 1400 : 1024);
}

function isGenuinelySimpleRecipe(analysis: FoodImageAnalysis): boolean {
  return /\b(plain|whole|sliced|fresh fruit|boiled egg|toast|fruit|watermelon|berries|grapes|banana|apple slices|orange wedges)\b/i.test(
    `${analysis.dishName} ${analysis.broadDishCategory}`,
  );
}

export function validateCompactRecipeOutput(
  output: CompactRecipeOutput,
  analysis: FoodImageAnalysis,
): string[] {
  const issues: string[] = [];
  const isPlatter = isGenuinePlatterMeal(analysis);
  const isDrink = isDrinkAnalysisText(`${analysis.dishName} ${analysis.broadDishCategory}`);

  if (!output.title.trim()) issues.push('missing_title');
  if (output.ingredients.length === 0) issues.push('missing_ingredients');
  if (output.ingredients.some((ingredient) => !hasUsableIngredientAmount(ingredient))) {
    issues.push('ingredient_missing_exact_quantity');
  }
  if (output.totalTime < 1) issues.push('invalid_total_time');
  if (!isGenuinelySimpleRecipe(analysis) && !isDrink && output.equipment.length === 0) {
    issues.push('missing_equipment');
  }

  const bounds = getRecipeStepBounds(analysis);
  if (output.steps.length < bounds.min) issues.push('too_few_steps');

  for (const step of output.steps) {
    if (requiresCompletionCue(step.instruction) &&
      !hasInstructionCompletion(step.instruction, step.doneWhen)) {
      issues.push('step_missing_time_or_completion_cue');
    }
    if (hasVagueCompactInstruction(step.instruction)) {
      issues.push('vague_step');
    }
  }

  if (hasUnlistedCompactStepIngredients(output)) {
    issues.push('step_uses_unlisted_ingredients');
  }

  const safetyRequirement = getRecipeSafetyRequirement(analysis, output.ingredients);
  const safetyNotes = output.steps.map((step) => step.safetyNote).join(' ');
  if (safetyRequirement && !safetyRequirement.pattern.test(safetyNotes)) {
    issues.push(`missing_safety_${safetyRequirement.code}`);
  }

  if (isPlatter) {
    const coverage = getRecipeComponentCoverage(
      (analysis.detectedComponents ?? []).map((component) => component.name),
      [
        output.title,
        ...output.ingredients.map(getCompactIngredientName),
        ...output.steps.map((step) => step.instruction),
      ],
    );
    if (coverage.coveragePercent < 90) issues.push('platter_coverage_below_90');
  }

  return [...new Set(issues)];
}

function getCompactSchemaIssues(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) =>
    `invalid_${issue.path.length > 0 ? issue.path.join('_') : 'schema'}`))];
}

export function hasUsableIngredientAmount(value: string): boolean {
  const text = value.trim().toLowerCase();
  if (/^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|a|an|pinch|dash)\b/.test(text)) {
    return true;
  }
  if (/\bto taste$/.test(text)) {
    return /\b(salt|pepper|lemon|lime|vinegar|hot sauce)\b/.test(text);
  }
  return false;
}

// Past-participle food descriptions ("cooked rice", "roasted chicken",
// "fried noodles") are ingredients, not cooking actions. Active instructions
// use an imperative, third-person, or progressive verb form.
const activeCookingActionPattern = /\b(?:bak(?:e|es|ing)|blanch(?:es|ing)?|boil(?:s|ing)?|brais(?:e|es|ing)|broil(?:s|ing)?|cook(?:s|ing)?|deep[- ]?(?:fry|fries|frying)|(?:fry|fries|frying)|grill(?:s|ing)?|heat(?:s|ing)?|melt(?:s|ing)?|microwav(?:e|es|ing)|pan[- ]?(?:fry|fries|frying)|poach(?:es|ing)?|preheat(?:s|ing)?|reduc(?:e|es|ing)|roast(?:s|ing)?|saut[eé](?:s|ing)?|sear(?:s|ing)?|simmer(?:s|ing)?|steam(?:s|ing)?|stew(?:s|ing)?|toast(?:s|ing)?)\b/i;
const preparationOnlyActionPattern = /^\s*(?:gather|measure|wash|rinse|pat|peel|trim|chop|slice|halve|cut|dice|mince|grate|shred|tear|combine|mix|whisk|toss|assemble|add|season|sprinkle|crack|open|drain|reserve|set aside|pour|transfer|roll|stretch|shape|knead|coat|brush|spread|top|place|layer|wrap|fill|stuff|press|form)\b/i;
const presentationOnlyActionPattern = /^\s*(?:plate|garnish|serve|divide|arrange|portion|ladle|spoon|drizzle|finish|enjoy)\b/i;

function isPresentationOnlyStep(instruction: string): boolean {
  return presentationOnlyActionPattern.test(instruction) &&
    !activeCookingActionPattern.test(instruction);
}

function requiresCompletionCue(instruction: string): boolean {
  if (activeCookingActionPattern.test(instruction)) return true;
  if (isPresentationOnlyStep(instruction)) return false;
  if (preparationOnlyActionPattern.test(instruction)) return false;
  // Unknown actions remain strict. Only explicitly recognized preparation and
  // presentation work is exempted from cookability evidence.
  return true;
}

function getInvalidCompletionStepIndices(
  steps: ProviderStepLike[],
): number[] {
  return steps
    .map((step, index) => {
      const instruction = getProviderStepText(step);
      const doneWhen = typeof step === 'object' && step ? step.doneWhen ?? '' : '';
      return requiresCompletionCue(instruction) &&
        !hasInstructionCompletion(instruction, doneWhen)
        ? index
        : -1;
    })
    .filter((index) => index >= 0);
}

function getPresentationOnlyStepIndices(
  steps: ProviderStepLike[],
): number[] {
  return steps
    .map((step, index) => isPresentationOnlyStep(getProviderStepText(step)) ? index : -1)
    .filter((index) => index >= 0);
}

function hasInstructionCompletion(instruction: string, doneWhen = ''): boolean {
  if (!requiresCompletionCue(instruction)) return true;
  const text = `${instruction} ${doneWhen}`;
  if (/\b\d+(?:\s*[-–]\s*\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i.test(text) ||
    /\b(golden|browned|opaque|translucent|tender|crisp|crispy|fragrant|aromatic|bubbling|boiling|simmering|thickened|coats?|combined|melted|wilted|reduced|steaming|al dente|set|firm|flaky|juices run clear|no pink|internal temperature|reaches? \d{2,3}|°f|°c|smooth|glossy|charred|softened|cold|chilled)\b/i.test(text)) {
    return true;
  }
  return false;
}

function hasVagueCompactInstruction(instruction: string): boolean {
  return /\bcook until done\b|\buntil ready\b|\bcook(?:ed|ing)? thoroughly\b|\bprepare (?:the )?ingredients\b|\bmix everything\b|\bmain ingredient\b/i.test(
    instruction,
  );
}

const recognizedIngredientMentions = [
  'butter', 'oil', 'salt', 'pepper', 'garlic', 'onion', 'ginger', 'sugar',
  'flour', 'egg', 'eggs', 'milk', 'cream', 'cheese', 'rice', 'pasta',
  'noodles', 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon',
  'cod', 'shrimp', 'prawn', 'tofu', 'tomato', 'potato', 'carrot', 'broccoli',
  'soy sauce', 'vinegar', 'lemon', 'lime', 'cilantro', 'parsley', 'basil',
  'paprika', 'cumin', 'chili', 'stock', 'broth', 'water', 'mayonnaise', 'mustard',
  'parmesan', 'mozzarella', 'cheddar', 'yogurt', 'sour cream', 'coconut milk',
  'sesame oil', 'olive oil', 'avocado oil', 'canola oil', 'vegetable oil',
  'honey', 'maple syrup', 'cornstarch', 'breadcrumbs', 'bread', 'tortilla',
  'spinach', 'kale', 'cabbage', 'lettuce', 'cucumber', 'avocado', 'mushroom',
  'peas', 'corn', 'beans', 'chickpeas', 'lentils', 'celery', 'scallion',
  'green onion', 'shallot', 'rosemary', 'thyme', 'oregano', 'dill', 'mint',
  'nutmeg', 'cinnamon', 'turmeric', 'cayenne', 'hot sauce', 'worcestershire sauce',
  'oyster sauce', 'fish sauce', 'tomato paste', 'wine',
  'bacon', 'sausage', 'ahi tuna', 'yellowfin tuna', 'tuna', 'tilapia', 'trout',
  'crab', 'lobster', 'squid',
  'steak', 'ground beef', 'ground pork', 'ground turkey',
];

function containsIngredientMention(text: string, ingredient: string): boolean {
  const pattern = ingredient
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return Boolean(pattern) && new RegExp(`\\b${pattern}\\b`, 'i').test(text);
}

type IngredientMentionDiagnostics = {
  aliasMatchesApplied: string[];
  suppressedNestedIngredientMentions: string[];
  unresolvedIngredientMentions: string[];
};

type IngredientMentionOccurrence = {
  candidate: string;
  concept: string;
  start: number;
  end: number;
  matchedIngredient?: string;
};

function isUnmeasuredUtilityWater(
  occurrence: IngredientMentionOccurrence,
  stepText: string,
): boolean {
  if (occurrence.concept !== 'water' || occurrence.matchedIngredient) return false;
  const nearbyText = stepText.slice(Math.max(0, occurrence.start - 36), occurrence.end + 48);
  const hasMeasuredWater = /(?:\d+(?:\.\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight)\s*(?:cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|milliliters?|ml|liters?|l)?\s+water\b/i.test(
    nearbyText,
  );
  if (hasMeasuredWater) return false;
  return /\b(?:pot|saucepan|kettle|sink|ice bath)\b[^.]{0,80}\bwater\b|\bwater\b[^.]{0,80}\b(?:boil|rinse|wash|drain|cover)\b|\b(?:boiling|ice|cold|running|tap|salted)\s+water\b/i.test(
    stepText,
  );
}

function getIngredientMentionOccurrences(
  text: string,
  candidates: string[],
  ingredients: string[],
): IngredientMentionOccurrence[] {
  return candidates.flatMap((candidate) => {
    const pattern = candidate
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    if (!pattern) return [];
    const matches = text.matchAll(new RegExp(`\\b${pattern}\\b`, 'gi'));
    return [...matches].map((match) => ({
      candidate,
      concept: canonicalIngredientName(candidate),
      start: match.index,
      end: match.index + match[0].length,
      matchedIngredient: findMatchingIngredientName(candidate, ingredients),
    }));
  });
}

function getIngredientMentionDiagnostics(
  stepTexts: string[],
  ingredients: string[],
): IngredientMentionDiagnostics {
  const listedConcepts = ingredients.map(canonicalIngredientName).filter(Boolean);
  const candidates = [...new Set([
    ...recognizedIngredientMentions,
    ...listedConcepts,
  ])].sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length);
  const aliasMatchesApplied = new Set<string>();
  const suppressedNestedIngredientMentions = new Set<string>();
  const unresolvedIngredientMentions = new Set<string>();

  for (const stepText of stepTexts) {
    const occurrences = getIngredientMentionOccurrences(stepText, candidates, ingredients);
    for (const occurrence of occurrences) {
      const shadowingMention = occurrences.find((other) =>
        other !== occurrence &&
        Boolean(other.matchedIngredient) &&
        other.start <= occurrence.start &&
        other.end >= occurrence.end &&
        (other.end - other.start) > (occurrence.end - occurrence.start));
      if (shadowingMention) {
        suppressedNestedIngredientMentions.add(occurrence.concept);
        continue;
      }
      if (isUnmeasuredUtilityWater(occurrence, stepText)) {
        suppressedNestedIngredientMentions.add(occurrence.concept);
        continue;
      }
      if (!occurrence.matchedIngredient) {
        if (occurrence.concept) unresolvedIngredientMentions.add(occurrence.concept);
        continue;
      }
      const matchedConcept = canonicalIngredientName(occurrence.matchedIngredient);
      if (occurrence.concept && occurrence.concept !== matchedConcept) {
        aliasMatchesApplied.add(`${occurrence.concept}->${matchedConcept}`);
      }
    }
  }

  return {
    aliasMatchesApplied: [...aliasMatchesApplied],
    suppressedNestedIngredientMentions: [...suppressedNestedIngredientMentions],
    unresolvedIngredientMentions: [...unresolvedIngredientMentions],
  };
}

function instructionUsesIngredient(instruction: string, ingredient: string): boolean {
  const canonical = canonicalIngredientName(ingredient);
  if (canonical && containsIngredientMention(instruction, canonical)) return true;
  return recognizedIngredientMentions.some((candidate) =>
    containsIngredientMention(instruction, candidate) &&
    ingredientsMatch(ingredient, candidate));
}

function hasUnlistedCompactStepIngredients(output: CompactRecipeOutput): boolean {
  return getUnlistedStepIngredientText(
    output.steps.map((step) => step.instruction),
    output.ingredients,
  ).length > 0;
}

function getUnlistedStepIngredientText(stepTexts: string[], ingredients: string[]): string[] {
  return getIngredientMentionDiagnostics(stepTexts, ingredients).unresolvedIngredientMentions;
}

const RAW_FISH_SAFETY_NOTE =
  'Use sushi-grade or previously frozen fish and keep it refrigerated until serving.';
const POULTRY_SAFETY_NOTE =
  'Cook poultry to an internal temperature of 165°F / 74°C.';
const GROUND_MEAT_SAFETY_NOTE =
  'Cook ground meat to an internal temperature of 160°F / 71°C.';
const PORK_SAFETY_NOTE =
  'Cook pork to an internal temperature of 145°F / 63°C.';
const COOKED_FISH_SAFETY_NOTE =
  'Cook fish to an internal temperature of 145°F / 63°C.';
const rawFishPreparationPattern = /\b(?:sushi|sashimi|ceviche|poke|crudo|tartare)\b/i;
const rawFishSubjectPattern = /\b(?:fish|salmon|tuna|yellowfin|ahi|bluefin|albacore|trout|snapper|halibut|sea bass)\b/i;
const poultrySubjectPattern = /\b(?:chicken|poultry|turkey|duck)\b/i;
const groundMeatSubjectPattern = /\b(?:ground|ground beef|ground pork|ground lamb|minced|burger|meatball|sausage)\b/i;
const porkSubjectPattern = /\bpork\b/i;
const cookedFishSubjectPattern = /\b(?:fish|salmon|cod|tilapia|tuna|trout|snapper|halibut|sea bass)\b/i;

function isExplicitRawFishPreparation(
  analysis: FoodImageAnalysis,
  ingredients: string[],
  steps: ProviderStepLike[] = [],
): boolean {
  const analysisAndSteps = [
    analysis.dishName,
    analysis.broadDishCategory,
    ...steps.map(getProviderStepText),
  ].join(' ');
  const fishEvidence = `${analysisAndSteps} ${ingredients.join(' ')}`;
  return rawFishSubjectPattern.test(fishEvidence) && (
    rawFishPreparationPattern.test(analysisAndSteps) ||
    /\braw\s+(?:fish|salmon|tuna|yellowfin|ahi|bluefin|albacore|trout|snapper|halibut|sea bass)\b/i.test(
      analysisAndSteps,
    )
  );
}

type PreparedProviderStep = {
  title: string;
  step: string;
  doneWhen?: string;
  safetyNote?: string;
};

type RecipeSafetyRequirement = {
  code: 'raw_fish' | 'poultry' | 'ground_meat' | 'pork' | 'cooked_fish';
  pattern: RegExp;
  targetPattern: RegExp;
  note: string;
};

const minimumSafeTemperatures: Partial<Record<RecipeSafetyRequirement['code'], {
  fahrenheit: number;
  celsius: number;
}>> = {
  poultry: { fahrenheit: 165, celsius: 74 },
  ground_meat: { fahrenheit: 160, celsius: 71 },
  pork: { fahrenheit: 145, celsius: 63 },
  cooked_fish: { fahrenheit: 145, celsius: 63 },
};

function hasUnsafeRequiredFoodTemperature(
  steps: ProviderStepLike[],
  requirement: RecipeSafetyRequirement,
): boolean {
  const minimum = minimumSafeTemperatures[requirement.code];
  if (!minimum) return false;
  return steps.some((step) => {
    const text = typeof step === 'string'
      ? step
      : `${getProviderStepText(step)} ${step.safetyNote ?? ''}`;
    if (!requirement.targetPattern.test(text)) return false;
    const temperatures = [...text.matchAll(/\b(\d{2,3})\s*°?\s*([fc])\b/gi)];
    return temperatures.some((match) => {
      const value = Number(match[1]);
      return match[2].toLowerCase() === 'f'
        ? value < minimum.fahrenheit
        : value < minimum.celsius;
    });
  });
}

function applyDeterministicRecipeSafety(
  steps: PreparedProviderStep[],
  analysis: FoodImageAnalysis,
  ingredients: string[],
): { steps: PreparedProviderStep[]; applied: boolean; fixesApplied: string[] } {
  const requirement = getRecipeSafetyRequirement(analysis, ingredients, steps);
  if (!requirement) {
    return { steps, applied: false, fixesApplied: [] };
  }
  const existingSafety = steps.map((step) =>
    `${step.step} ${step.safetyNote ?? ''}`).join(' ');
  if (requirement.pattern.test(existingSafety)) {
    return { steps, applied: false, fixesApplied: [] };
  }
  const cookingTargetIndex = steps.findIndex((step) =>
    requirement.targetPattern.test(step.step) && activeCookingActionPattern.test(step.step));
  const subjectTargetIndex = steps.findIndex((step) => requirement.targetPattern.test(step.step));
  const activeTargetIndex = steps.findIndex((step) => activeCookingActionPattern.test(step.step));
  const safeTargetIndex = cookingTargetIndex >= 0
    ? cookingTargetIndex
    : subjectTargetIndex >= 0
      ? subjectTargetIndex
      : activeTargetIndex >= 0 ? activeTargetIndex : 0;
  return {
    steps: steps.map((step, index) => index === safeTargetIndex
      ? {
          ...step,
          safetyNote: step.safetyNote
            ? `${step.safetyNote} ${requirement.note}`
            : requirement.note,
        }
      : step),
    applied: true,
    fixesApplied: [`missing_safety_${requirement.code}`],
  };
}

function getRecipeSafetyRequirement(
  analysis: FoodImageAnalysis,
  ingredients: string[],
  steps: ProviderStepLike[] = [],
): RecipeSafetyRequirement | null {
  const text = `${analysis.dishName} ${analysis.broadDishCategory} ${ingredients.join(' ')}`.toLowerCase();
  if (isExplicitRawFishPreparation(analysis, ingredients, steps)) {
    return {
      code: 'raw_fish',
      pattern: /(?=[\s\S]*\b(?:sushi[- ]grade|previously frozen)\b)(?=[\s\S]*\b(?:keep(?: it| the fish)? (?:chilled|cold|refrigerated)|refrigerated until serving)\b)[\s\S]*/i,
      targetPattern: rawFishSubjectPattern,
      note: RAW_FISH_SAFETY_NOTE,
    };
  }
  if (poultrySubjectPattern.test(text)) {
    return {
      code: 'poultry',
      pattern: /\b165\s*°?\s*f\b|\b74\s*°?\s*c\b/i,
      targetPattern: poultrySubjectPattern,
      note: POULTRY_SAFETY_NOTE,
    };
  }
  if (/\b(ground|minced|burger|meatball|sausage)\b/.test(text) && /\b(beef|pork|lamb|meat)\b/.test(text)) {
    return {
      code: 'ground_meat',
      pattern: /\b160\s*°?\s*f\b|\b71\s*°?\s*c\b/i,
      targetPattern: groundMeatSubjectPattern,
      note: GROUND_MEAT_SAFETY_NOTE,
    };
  }
  if (porkSubjectPattern.test(text)) {
    return {
      code: 'pork',
      pattern: /\b145\s*°?\s*f\b|\b63\s*°?\s*c\b/i,
      targetPattern: porkSubjectPattern,
      note: PORK_SAFETY_NOTE,
    };
  }
  if (cookedFishSubjectPattern.test(text)) {
    return {
      code: 'cooked_fish',
      pattern: /\b145\s*°?\s*f\b|\b63\s*°?\s*c\b/i,
      targetPattern: cookedFishSubjectPattern,
      note: COOKED_FISH_SAFETY_NOTE,
    };
  }
  return null;
}

function getRecipeComponentCoverage(
  detectedComponents: string[],
  generatedComponents: string[],
): { coveragePercent: number; missingComponents: string[] } {
  if (detectedComponents.length === 0) {
    return { coveragePercent: 100, missingComponents: [] };
  }
  const missingComponents = detectedComponents.filter((detected) =>
    !isRecipeComponentCovered(detected, generatedComponents));
  return {
    coveragePercent: Math.round((1 - missingComponents.length / detectedComponents.length) * 100),
    missingComponents,
  };
}

function isRecipeComponentCovered(detected: string, generated: string[]): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const detectedNormalized = normalize(detected);
  return generated.some((component) => {
    const componentNormalized = normalize(component);
    if (
      componentNormalized === detectedNormalized ||
      componentNormalized.includes(detectedNormalized) ||
      detectedNormalized.includes(componentNormalized)
    ) {
      return true;
    }
    const detectedTokens = detectedNormalized.split(' ').filter((token) => token.length > 2);
    const componentTokens = componentNormalized.split(' ').filter((token) => token.length > 2);
    if (detectedTokens.length === 0 || componentTokens.length === 0) return false;
    const shorter = detectedTokens.length <= componentTokens.length ? detectedTokens : componentTokens;
    const longer = detectedTokens.length <= componentTokens.length ? componentTokens : detectedTokens;
    const hits = shorter.filter((token) =>
      longer.some((other) => other.includes(token) || token.includes(other)));
    return hits.length >= Math.ceil(shorter.length * 0.6);
  });
}

function getCompactIngredientName(value: string): string {
  return value
    .replace(
      /^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|one|two|three|four|five|six|a|an|pinch|dash)\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|cloves?|slices?|cans?|bunches?|pieces?|packages?|large|medium|small)?\s+/i,
      '',
    )
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim();
}

function isRepairableRecipeOutputError(error: unknown): boolean {
  return error instanceof OpenRouterProviderError && [
    'openrouter_empty_content',
    'openrouter_invalid_json',
    'openrouter_invalid_schema',
    'openrouter_output_truncated',
  ].includes(error.failure.reason);
}

function isScanControlError(error: unknown): boolean {
  return error instanceof ScanDeadlineExceededError || error instanceof ScanCancelledError;
}

// Strict structural validation of the single recipe. Returns issue codes (empty
// = valid). Derivable metadata is normalized locally before this runs, so only
// user-visible recipe structure remains fail-closed.
export function validateRecipeStructure(
  output: OpenRouterRecipeOutput,
  analysis?: FoodImageAnalysis,
): string[] {
  const issues: string[] = [];
  const steps = Array.isArray(output.steps) ? output.steps : null;
  if (!steps) {
    return ['steps_not_array'];
  }
  const bounds = analysis ? getRecipeStepBounds(analysis) : { min: 4, max: 14 };
  if (steps.length < bounds.min) issues.push('too_few_steps');

  for (const step of steps) {
    if (typeof step === 'string' || !step || typeof step !== 'object') {
      issues.push('step_not_structured');
      continue;
    }
    const instruction = (step.step || step.instruction || step.text || '').trim();
    if (!instruction) issues.push('step_missing_instruction');
    if (!(step.title || '').trim()) issues.push('step_missing_title');
  }

  return [...new Set(issues)];
}

async function callRecipeStage(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
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
          content: 'You are a professional chef assistant and food reverse-engineering specialist generating ONE safe, cookable home recipe for a beginner. For a platter or multi-component meal, cover every distinct detected component in the single recipe. Return one complete JSON object only. Do not return multiple recipes, modes, markdown, reasoning, or explanations.',
        },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
      stage,
      quota: input.quota,
      requestId: input.requestId,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
      timing: input.timing,
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

async function callRecipeRepairStage(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    quota: ProviderQuota;
  } & Partial<ScanExecutionContext>,
  userPrompt: string,
  maxTokens: number,
  stage: string,
): Promise<unknown> {
  return callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'You repair one safe home recipe. Return only the requested minified JSON. No markdown, reasoning, modes, variants, or extra keys.',
        },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
      stage,
      quota: input.quota,
      requestId: input.requestId,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
      timing: input.timing,
    },
    getRecipeModelChain(input.config),
  );
}

type FullRecipeRepairStep = z.infer<typeof fullRecipeRepairStepSchema>;
type FullRecipeIndexedStepCorrection = z.infer<typeof fullRecipeIndexedStepCorrectionSchema>;
type FullRecipeIngredientCorrection = z.infer<typeof fullRecipeIngredientCorrectionSchema>;

type RepairReturnedStepNumber = {
  returnedPosition: number;
  stepIndex?: number;
  stepNumber?: number;
};

type RejectedRepairStepIndex = {
  returnedPosition: number;
  targetIndex?: number;
  reason: string;
};

type RepairStepHash = {
  stepIndex?: number;
  returnedPosition?: number;
  hash: string;
};

type CompletionRepairMerge = {
  steps: ProviderStepLike[];
  acceptedStepIndices: number[];
  rejectedStepIndices: RejectedRepairStepIndex[];
  returnedIndices: number[];
  missingReturnedIndices: number[];
  duplicateReturnedIndices: number[];
  unrequestedReturnedIndices: number[];
};

type IngredientRepairMerge = {
  ingredients: string[];
  returnedIngredientIndices: number[];
  missingIngredientIndices: number[];
  duplicateIngredientIndices: number[];
  unrequestedIngredientIndices: number[];
};

function getRawRepairStepNumbers(repairJson: unknown): RepairReturnedStepNumber[] {
  const record = getRecord(repairJson);
  const steps = Array.isArray(record?.stepCorrections)
    ? record.stepCorrections
    : Array.isArray(record?.steps) ? record.steps : [];
  return steps.map((step, returnedPosition) => {
    const stepRecord = getRecord(step);
    return {
      returnedPosition,
      ...(typeof stepRecord?.stepIndex === 'number'
        ? { stepIndex: stepRecord.stepIndex }
        : {}),
      ...(typeof stepRecord?.stepNumber === 'number'
        ? { stepNumber: stepRecord.stepNumber }
        : {}),
    };
  });
}

function getParsedRepairStepNumbers(
  steps: Array<FullRecipeRepairStep | FullRecipeIndexedStepCorrection>,
): RepairReturnedStepNumber[] {
  return steps.map((step, returnedPosition) => ({
    returnedPosition,
    ...(step.stepIndex !== undefined ? { stepIndex: step.stepIndex } : {}),
    ...('stepNumber' in step && step.stepNumber !== undefined
      ? { stepNumber: step.stepNumber }
      : {}),
  }));
}

function getRepairStepHash(step: ProviderStepLike | undefined): string {
  const record = typeof step === 'object' && step ? step : {};
  const safeCompletionText = [
    getProviderStepText(step),
    record.doneWhen ?? '',
    record.safetyNote ?? '',
  ].join('\n');
  return createHash('sha256').update(safeCompletionText).digest('hex').slice(0, 16);
}

function getIndexedStepHashes(steps: ProviderStepLike[]): RepairStepHash[] {
  return steps.map((step, stepIndex) => ({
    stepIndex,
    hash: getRepairStepHash(step),
  }));
}

function mergeIndexedStepCorrection(
  previousStep: ProviderStepLike,
  correction: FullRecipeIndexedStepCorrection,
): ProviderStepLike {
  const previousRecord: SafeRecord = typeof previousStep === 'object' && previousStep
    ? previousStep
    : {};
  const correctedInstruction = getProviderStepText(correction).trim();
  return {
    ...previousRecord,
    title: correction.title?.trim() || String(previousRecord.title ?? '').trim(),
    step: correctedInstruction,
    doneWhen: correction.doneWhen !== undefined
      ? correction.doneWhen.trim()
      : String(previousRecord.doneWhen ?? '').trim(),
    safetyNote: correction.safetyNote !== undefined
      ? correction.safetyNote.trim()
      : String(previousRecord.safetyNote ?? '').trim(),
  };
}

function mapIndexedRepairSteps(
  previousSteps: ProviderStepLike[],
  returnedSteps: FullRecipeIndexedStepCorrection[],
  requestedInvalidIndices: number[],
): CompletionRepairMerge {
  const requested = new Set(requestedInvalidIndices);
  const returnedIndices = returnedSteps.map((step) => step.stepIndex);
  const counts = new Map<number, number>();
  returnedIndices.forEach((stepIndex) =>
    counts.set(stepIndex, (counts.get(stepIndex) ?? 0) + 1));
  const missingReturnedIndices = requestedInvalidIndices.filter(
    (stepIndex) => !counts.has(stepIndex),
  );
  const duplicateReturnedIndices = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([stepIndex]) => stepIndex)
    .sort((a, b) => a - b);
  const unrequestedReturnedIndices = [...new Set(returnedIndices.filter(
    (stepIndex) => !requested.has(stepIndex),
  ))].sort((a, b) => a - b);
  const accepted = new Set<number>();
  const rejectedStepIndices: RejectedRepairStepIndex[] = [];
  const mergedSteps = [...previousSteps];

  returnedSteps.forEach((step, returnedPosition) => {
    const targetIndex = step.stepIndex;
    if (targetIndex < 0 || targetIndex >= previousSteps.length) {
      rejectedStepIndices.push({
        returnedPosition,
        targetIndex,
        reason: 'step_index_out_of_range',
      });
      return;
    }
    if (!requested.has(targetIndex)) {
      rejectedStepIndices.push({
        returnedPosition,
        targetIndex,
        reason: 'step_index_not_requested',
      });
      return;
    }
    if ((counts.get(targetIndex) ?? 0) > 1) {
      rejectedStepIndices.push({
        returnedPosition,
        targetIndex,
        reason: 'duplicate_step_index',
      });
      return;
    }

    accepted.add(targetIndex);
    mergedSteps[targetIndex] = mergeIndexedStepCorrection(
      previousSteps[targetIndex],
      step,
    );
  });

  return {
    steps: mergedSteps,
    acceptedStepIndices: [...accepted].sort((a, b) => a - b),
    rejectedStepIndices,
    returnedIndices,
    missingReturnedIndices,
    duplicateReturnedIndices,
    unrequestedReturnedIndices,
  };
}

function mapIndexedIngredientCorrections(
  previousIngredients: string[],
  returnedCorrections: FullRecipeIngredientCorrection[],
  requestedIngredientIndices: number[],
): IngredientRepairMerge {
  const requested = new Set(requestedIngredientIndices);
  const returnedIngredientIndices = returnedCorrections.map(
    (correction) => correction.ingredientIndex,
  );
  const counts = new Map<number, number>();
  returnedIngredientIndices.forEach((ingredientIndex) =>
    counts.set(ingredientIndex, (counts.get(ingredientIndex) ?? 0) + 1));
  const missingIngredientIndices = requestedIngredientIndices.filter(
    (ingredientIndex) => !counts.has(ingredientIndex),
  );
  const duplicateIngredientIndices = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([ingredientIndex]) => ingredientIndex)
    .sort((a, b) => a - b);
  const unrequestedIngredientIndices = [...new Set(returnedIngredientIndices.filter(
    (ingredientIndex) => !requested.has(ingredientIndex),
  ))].sort((a, b) => a - b);
  const ingredients = [...previousIngredients];

  for (const correction of returnedCorrections) {
    const targetIndex = correction.ingredientIndex;
    if (targetIndex < 0 || targetIndex >= previousIngredients.length) continue;
    if (!requested.has(targetIndex)) continue;
    if ((counts.get(targetIndex) ?? 0) > 1) continue;
    ingredients[targetIndex] = correction.value.trim();
  }

  return {
    ingredients,
    returnedIngredientIndices,
    missingIngredientIndices,
    duplicateIngredientIndices,
    unrequestedIngredientIndices,
  };
}

const indexedFullRecipeRepairIssues = new Set([
  'ingredients_missing_amounts',
  'step_missing_time_or_completion_cue',
  'step_uses_unlisted_ingredients',
]);

type FullRecipeRepairMode = 'indexed' | 'whole_recipe_regeneration';

type FullRecipeRepairApplication = {
  output: OpenRouterRecipeOutput;
  warnings: string[];
};

function selectFullRecipeRepairMode(
  previousOutput: OpenRouterRecipeOutput | undefined,
  _issues: string[],
): FullRecipeRepairMode {
  if (!previousOutput) return 'whole_recipe_regeneration';
  // Parsed recipes never replace complete arrays in the ordinary scan path.
  // Fatal structural defects are rejected before this point; all eligible
  // content repairs use exact indexed corrections.
  return 'indexed';
}

function applyFullRecipeRepairPatch(
  input: { analysis: FoodImageAnalysis } & Partial<ScanExecutionContext>,
  previousOutput: OpenRouterRecipeOutput,
  repairJson: unknown,
  issues: string[],
  isDrink: boolean,
  selectedRepairMode: FullRecipeRepairMode,
  initialNormalizationDiagnostics?: FullRecipeNormalizationDiagnostics,
): FullRecipeRepairApplication {
  const initialDiagnostics = getFullRecipeRepairDiagnostics(previousOutput, input.analysis);
  if (selectedRepairMode !== 'indexed') {
    throw new RecipeValidationError(['repair_invalid_mode']);
  }

  const requestedIngredientIndices = issues.includes('ingredients_missing_amounts')
    ? initialDiagnostics.ingredientIndicesMissingAmounts
    : [];
  const completionStepIndices = issues.includes('step_missing_time_or_completion_cue')
    ? initialDiagnostics.stepsMissingCompletionCue
    : [];
  const closureStepIndices = issues.includes('step_uses_unlisted_ingredients')
    ? initialDiagnostics.stepsUsingUnlistedIngredientIndices
    : [];
  const requestedStepIndices = [...new Set([
    ...completionStepIndices,
    ...closureStepIndices,
  ])].sort((a, b) => a - b);
  const rawReturnedStepNumbers = getRawRepairStepNumbers(repairJson);
  const originalStepTextHashes = getIndexedStepHashes(previousOutput.steps);
  const parsedPatch = fullRecipeIndexedRepairPatchSchema.safeParse(repairJson);
  if (!parsedPatch.success) {
    logFullRecipeRepairTrace(input, {
      requestedIngredientIndices,
      returnedIngredientIndices: [],
      missingIngredientIndices: requestedIngredientIndices,
      duplicateIngredientIndices: [],
      unrequestedIngredientIndices: [],
      changedIngredientIndices: [],
      requestedStepIndices,
      returnedStepIndices: [],
      missingStepIndices: requestedStepIndices,
      changedStepIndices: [],
      originalStepCount: previousOutput.steps.length,
      mergedStepCount: previousOutput.steps.length,
      requestedInvalidIndices: requestedStepIndices,
      requiredReturnedIndices: requestedStepIndices,
      returnedIndices: [],
      missingReturnedIndices: requestedStepIndices,
      duplicateReturnedIndices: [],
      unrequestedReturnedIndices: [],
      changedRequestedIndices: [],
      unchangedRequestedIndices: requestedStepIndices,
      resolvedRequestedIndices: [],
      unresolvedRequestedIndices: requestedStepIndices,
      aliasMatchesApplied: initialNormalizationDiagnostics?.aliasMatchesApplied ?? [],
      suppressedNestedIngredientMentions:
        initialNormalizationDiagnostics?.suppressedNestedIngredientMentions ?? [],
      unresolvedIngredientMentions:
        initialNormalizationDiagnostics?.unresolvedIngredientMentions ?? [],
      deterministicSafetyApplied:
        initialNormalizationDiagnostics?.deterministicSafetyApplied ?? false,
      finalFailureReasons: ['repair_invalid_schema'],
      rawReturnedStepNumbers,
      parsedReturnedStepNumbers: [],
      acceptedStepIndices: [],
      rejectedStepIndices: rawReturnedStepNumbers.map(({ returnedPosition }) => ({
        returnedPosition,
        reason: 'repair_schema_invalid',
      })),
      originalStepTextHashes,
      repairedStepTextHashes: [],
      mergedStepTextHashes: originalStepTextHashes,
      changedFields: [],
    });
    logFullRecipeRepairValidation(input, {
      initialInvalidStepIndices: requestedStepIndices,
      repairedInvalidStepIndices: [],
      unknownIngredientsBeforeRepair: initialDiagnostics.unknownIngredients,
      unknownIngredientsAfterRepair: [],
      presentationOnlyStepIndices: initialDiagnostics.presentationOnlyStepIndices,
      repairChangedFields: [],
    });
    throw new RecipeValidationError(['repair_invalid_schema']);
  }

  const canonicalIngredients = normalizeProviderIngredientList(previousOutput.ingredients);
  const ingredientCorrections = parsedPatch.data.ingredientCorrections;
  const patchSteps = parsedPatch.data.stepCorrections;
  const parsedReturnedStepNumbers = getParsedRepairStepNumbers(patchSteps);
  const ingredientMerge = mapIndexedIngredientCorrections(
    canonicalIngredients,
    ingredientCorrections,
    requestedIngredientIndices,
  );
  const stepMerge = mapIndexedRepairSteps(
    previousOutput.steps,
    patchSteps,
    requestedStepIndices,
  );
  const merged = openRouterRecipeOutputSchema.parse({
    ...previousOutput,
    ingredients: ingredientMerge.ingredients,
    steps: stepMerge.steps,
  });
  const finalNormalization = normalizeFullRecipeOutputWithDiagnostics(merged, input.analysis);
  const normalized = finalNormalization.output;
  const finalDiagnostics = getFullRecipeRepairDiagnostics(normalized, input.analysis);
  const finalChangedFields = getRepairChangedFields(
    previousOutput,
    normalized.ingredients,
    normalized.steps,
  );
  const changedIngredientIndices = requestedIngredientIndices.filter((ingredientIndex) =>
    finalChangedFields.includes(`ingredients.${ingredientIndex}`));
  const changedStepIndices = requestedStepIndices.filter((stepIndex) =>
    finalChangedFields.some((field) => field.startsWith(`steps.${stepIndex}.`)));
  const resolvedIngredientIndices = requestedIngredientIndices.filter((ingredientIndex) =>
    changedIngredientIndices.includes(ingredientIndex) &&
    hasUsableIngredientAmount(normalized.ingredients[ingredientIndex] ?? '') &&
    ingredientsMatch(
      canonicalIngredients[ingredientIndex] ?? '',
      normalized.ingredients[ingredientIndex] ?? '',
    ));
  const unresolvedIngredientIndices = requestedIngredientIndices.filter(
    (ingredientIndex) => !resolvedIngredientIndices.includes(ingredientIndex),
  );
  const resolvedRequestedIndices = requestedStepIndices.filter((stepIndex) => {
    if (!changedStepIndices.includes(stepIndex)) return false;
    if (completionStepIndices.includes(stepIndex) &&
      finalDiagnostics.stepsMissingCompletionCue.includes(stepIndex)) return false;
    if (closureStepIndices.includes(stepIndex) &&
      finalDiagnostics.stepsUsingUnlistedIngredientIndices.includes(stepIndex)) return false;
    return true;
  });
  const unresolvedRequestedIndices = requestedStepIndices.filter(
    (stepIndex) => !resolvedRequestedIndices.includes(stepIndex),
  );
  const coverageFailures = [
    ...(ingredientMerge.missingIngredientIndices.length > 0 ||
      stepMerge.missingReturnedIndices.length > 0
      ? ['repair_missing_required_correction'] : []),
    ...(ingredientMerge.duplicateIngredientIndices.length > 0 ||
      stepMerge.duplicateReturnedIndices.length > 0
      ? ['repair_duplicate_correction'] : []),
  ];
  const repairWarnings = [
    ...(ingredientMerge.unrequestedIngredientIndices.length > 0 ||
      stepMerge.unrequestedReturnedIndices.length > 0
      ? ['repair_unrequested_correction'] : []),
  ];
  const finalValidationFailures = validateFullRecipeOutput(normalized, input.analysis, isDrink);
  const requestedCorrectionCount = requestedIngredientIndices.length + requestedStepIndices.length;
  const changedCorrectionCount = changedIngredientIndices.length + changedStepIndices.length;
  const noEffect = coverageFailures.length === 0 &&
    requestedCorrectionCount > 0 && changedCorrectionCount === 0;
  const partialEffect = coverageFailures.length === 0 && !noEffect && (
    unresolvedIngredientIndices.length > 0 ||
    unresolvedRequestedIndices.length > 0 ||
    finalValidationFailures.length > 0
  );
  const finalFailureReasons = [...new Set([
    ...coverageFailures,
    ...(noEffect ? ['repair_no_effect'] : []),
    ...(partialEffect ? ['repair_partial_effect'] : []),
    ...finalValidationFailures,
  ])];
  const repairedStepTextHashes = patchSteps.map((step, returnedPosition) => ({
    returnedPosition,
    ...(stepMerge.returnedIndices[returnedPosition] !== undefined
      ? { stepIndex: stepMerge.returnedIndices[returnedPosition] }
      : {}),
    hash: getRepairStepHash(step),
  }));
  const aliasMatchesApplied = [...new Set([
    ...(initialNormalizationDiagnostics?.aliasMatchesApplied ?? []),
    ...finalNormalization.diagnostics.aliasMatchesApplied,
  ])];
  const suppressedNestedIngredientMentions = [...new Set([
    ...(initialNormalizationDiagnostics?.suppressedNestedIngredientMentions ?? []),
    ...finalNormalization.diagnostics.suppressedNestedIngredientMentions,
  ])];
  logFullRecipeRepairTrace(input, {
    requestedIngredientIndices,
    returnedIngredientIndices: ingredientMerge.returnedIngredientIndices,
    missingIngredientIndices: ingredientMerge.missingIngredientIndices,
    duplicateIngredientIndices: ingredientMerge.duplicateIngredientIndices,
    unrequestedIngredientIndices: ingredientMerge.unrequestedIngredientIndices,
    changedIngredientIndices,
    requestedStepIndices,
    returnedStepIndices: stepMerge.returnedIndices,
    missingStepIndices: stepMerge.missingReturnedIndices,
    changedStepIndices,
    originalStepCount: previousOutput.steps.length,
    mergedStepCount: normalized.steps.length,
    requestedInvalidIndices: requestedStepIndices,
    requiredReturnedIndices: requestedStepIndices,
    returnedIndices: stepMerge.returnedIndices,
    missingReturnedIndices: stepMerge.missingReturnedIndices,
    duplicateReturnedIndices: stepMerge.duplicateReturnedIndices,
    unrequestedReturnedIndices: stepMerge.unrequestedReturnedIndices,
    changedRequestedIndices: changedStepIndices,
    unchangedRequestedIndices: requestedStepIndices.filter(
      (stepIndex) => !changedStepIndices.includes(stepIndex),
    ),
    resolvedRequestedIndices,
    unresolvedRequestedIndices,
    aliasMatchesApplied,
    suppressedNestedIngredientMentions,
    unresolvedIngredientMentions: finalDiagnostics.unknownIngredients,
    deterministicSafetyApplied:
      (initialNormalizationDiagnostics?.deterministicSafetyApplied ?? false) ||
      finalNormalization.diagnostics.deterministicSafetyApplied,
    finalFailureReasons,
    rawReturnedStepNumbers,
    parsedReturnedStepNumbers,
    acceptedStepIndices: stepMerge.acceptedStepIndices,
    rejectedStepIndices: stepMerge.rejectedStepIndices,
    originalStepTextHashes,
    repairedStepTextHashes,
    mergedStepTextHashes: getIndexedStepHashes(normalized.steps),
    changedFields: finalChangedFields,
  });
  logFullRecipeRepairValidation(input, {
    initialInvalidStepIndices: requestedStepIndices,
    repairedInvalidStepIndices: finalDiagnostics.stepsMissingCompletionCue,
    unknownIngredientsBeforeRepair: initialDiagnostics.unknownIngredients,
    unknownIngredientsAfterRepair: finalDiagnostics.unknownIngredients,
    presentationOnlyStepIndices: finalDiagnostics.presentationOnlyStepIndices,
    repairChangedFields: finalChangedFields,
  });
  if (repairWarnings.length > 0) {
    console.log('[recipe_repair_warning]', {
      requestId: input.requestId,
      warnings: repairWarnings,
    });
  }
  if (finalFailureReasons.length > 0) {
    throw new RecipeValidationError(finalFailureReasons);
  }
  return { output: normalized, warnings: repairWarnings };
}

function getRepairChangedFields(
  previousOutput: OpenRouterRecipeOutput,
  repairedIngredients: string[],
  repairedSteps: ProviderStepLike[],
): string[] {
  const changed = new Set<string>();
  const previousIngredients = normalizeProviderIngredientList(previousOutput.ingredients);
  const nextIngredients = normalizeProviderIngredientList(repairedIngredients);
  const maxIngredients = Math.max(previousIngredients.length, nextIngredients.length);
  for (let index = 0; index < maxIngredients; index += 1) {
    if ((previousIngredients[index] ?? '') !== (nextIngredients[index] ?? '')) {
      changed.add(`ingredients.${index}`);
    }
  }
  if (previousOutput.steps.length !== repairedSteps.length) {
    changed.add('steps.length');
  }
  const maxSteps = Math.max(previousOutput.steps.length, repairedSteps.length);
  for (let index = 0; index < maxSteps; index += 1) {
    const before = previousOutput.steps[index];
    const after = repairedSteps[index];
    if (!before || !after) continue;
    const beforeRecord: SafeRecord = typeof before === 'object' && before ? before : {};
    const afterRecord: SafeRecord = typeof after === 'object' && after ? after : {};
    const fields = {
      title: [beforeRecord.title ?? '', afterRecord.title ?? ''],
      step: [getProviderStepText(before), getProviderStepText(after)],
      doneWhen: [beforeRecord.doneWhen ?? '', afterRecord.doneWhen ?? ''],
      safetyNote: [beforeRecord.safetyNote ?? '', afterRecord.safetyNote ?? ''],
    };
    for (const [field, [beforeValue, afterValue]] of Object.entries(fields)) {
      if (String(beforeValue).trim() !== String(afterValue).trim()) {
        changed.add(`steps.${index}.${field}`);
      }
    }
  }
  return [...changed];
}

function logFullRecipeRepairValidation(
  input: Partial<ScanExecutionContext>,
  details: {
    initialInvalidStepIndices: number[];
    repairedInvalidStepIndices: number[];
    unknownIngredientsBeforeRepair: string[];
    unknownIngredientsAfterRepair: string[];
    presentationOnlyStepIndices: number[];
    repairChangedFields: string[];
  },
): void {
  console.log('[recipe_repair_validation]', {
    requestId: input.requestId,
    ...details,
  });
}

function logFullRecipeRepairTrace(
  input: Partial<ScanExecutionContext>,
  details: {
    requestedIngredientIndices: number[];
    returnedIngredientIndices: number[];
    missingIngredientIndices: number[];
    duplicateIngredientIndices: number[];
    unrequestedIngredientIndices: number[];
    changedIngredientIndices: number[];
    requestedStepIndices: number[];
    returnedStepIndices: number[];
    missingStepIndices: number[];
    changedStepIndices: number[];
    originalStepCount: number;
    mergedStepCount: number;
    requestedInvalidIndices: number[];
    requiredReturnedIndices: number[];
    returnedIndices: number[];
    missingReturnedIndices: number[];
    duplicateReturnedIndices: number[];
    unrequestedReturnedIndices: number[];
    changedRequestedIndices: number[];
    unchangedRequestedIndices: number[];
    resolvedRequestedIndices: number[];
    unresolvedRequestedIndices: number[];
    aliasMatchesApplied: string[];
    suppressedNestedIngredientMentions: string[];
    unresolvedIngredientMentions: string[];
    deterministicSafetyApplied: boolean;
    finalFailureReasons: string[];
    rawReturnedStepNumbers: RepairReturnedStepNumber[];
    parsedReturnedStepNumbers: RepairReturnedStepNumber[];
    acceptedStepIndices: number[];
    rejectedStepIndices: RejectedRepairStepIndex[];
    originalStepTextHashes: RepairStepHash[];
    repairedStepTextHashes: RepairStepHash[];
    mergedStepTextHashes: RepairStepHash[];
    changedFields: string[];
  },
): void {
  console.log('[recipe_repair_trace]', {
    requestId: input.requestId,
    indexSemantics: {
      ingredientIndex: 'zero_based',
      stepIndex: 'zero_based',
      targetedRepairContract: 'exact_indexed_corrections',
      fullArrays: 'rejected_for_targeted_repair',
    },
    ...details,
  });
}

// Detects recipe output that is too vague to cook from. Returns a list of issue
// codes (empty = good enough). Drives the one-shot repair retry above.
function getRecipeQualityIssues(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
  isDrink: boolean,
): string[] {
  const issues: string[] = [];
  const ingredients = (Array.isArray(output.ingredients) ? output.ingredients : [])
    .map((value) => (typeof value === 'string' ? value : '').trim())
    .filter(Boolean);
  const stepTexts = (Array.isArray(output.steps) ? output.steps : [])
    .map((value) => (typeof value === 'string' ? value : (value?.step || value?.instruction || value?.text || '')).trim())
    .filter(Boolean);
  const stepValidationTexts = (Array.isArray(output.steps) ? output.steps : [])
    .map((value) => typeof value === 'string'
      ? value
      : `${getProviderStepText(value)} ${value?.doneWhen ?? ''}`.trim())
    .filter(Boolean);
  const allText = `${output.title ?? ''} ${output.description ?? ''} ${ingredients.join(' ')} ${stepTexts.join(' ')}`.toLowerCase();

  if (/\bmain ingredient\b/.test(allText)) {
    issues.push('vague_main_ingredient');
  }
  const minimumIngredientCount = isGenuinelySimpleRecipe(analysis) ? 1 : isDrink ? 2 : 4;
  if (ingredients.length < minimumIngredientCount) {
    issues.push('too_few_ingredients');
  }
  const vagueStandalone = ingredients.filter((value) => standaloneVagueIngredient.test(value.toLowerCase().trim()));
  if (vagueStandalone.length > 0) {
    issues.push('vague_ingredient_name');
  }
  const missingAmounts = ingredients.filter((value) => !hasUsableIngredientAmount(value));
  if (missingAmounts.length > 0) {
    issues.push('ingredients_missing_amounts');
  }
  if (stepValidationTexts.some((step) => vagueStepPattern.test(step.toLowerCase()))) {
    issues.push('vague_step');
  }
  const stepCompletionIssues = getInvalidCompletionStepIndices(output.steps).length > 0;
  if (stepCompletionIssues) {
    issues.push('step_missing_time_or_completion_cue');
  }
  if (isDrink && stepTexts.some((step) => /\b(oven|skillet|saut[eé]|bake|roast|sear|pan-fry|°f|°c|internal temp)\b/i.test(step))) {
    issues.push('drink_uses_cooking_language');
  }

  // Ingredient closure: every ingredient a step declares must resolve to the
  // top-level ingredient list. Caught here so the one-shot repair can fix it;
  // the final post-transformation aiService gate remains fail-closed.
  const stepIngredientNames = (Array.isArray(output.steps) ? output.steps : [])
    .flatMap((value) => {
      if (typeof value !== 'object' || value === null) return [] as string[];
      const names = Array.isArray(value.ingredients)
        ? value.ingredients
        : Array.isArray(value.ingredientsUsed)
          ? value.ingredientsUsed
          : [];
      return names.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0,
      );
    });
  const unlistedStepIngredients = stepIngredientNames.filter(
    (name) => !ingredients.some((listed) => ingredientsMatch(listed, name)),
  );
  if (unlistedStepIngredients.length > 0) {
    issues.push('step_uses_unlisted_ingredients');
  }
  if (getUnlistedStepIngredientText(stepTexts, ingredients).length > 0) {
    issues.push('step_uses_unlisted_ingredients');
  }

  return [...new Set(issues)];
}

const standaloneVagueIngredient = /^(the\s+)?(main ingredients?|protein|proteins|vegetables?|veggies|sauce|sauces|seasoning|seasonings|spice|spices|toppings?|ingredients|filling|stuff)$/;
const vagueStepPattern = /\bcook until done\b|\buntil ready\b|\bcook(?:ed|ing)? thoroughly\b|\bprepare the ingredients\b|\bmix everything\b|\bseason to taste\b|\b(cook|add|prepare|make) the (main ingredient|protein|vegetables|sauce)\b/;

function getFullRecipeRepairPrompt(
  analysis: FoodImageAnalysis,
  previousOutput: OpenRouterRecipeOutput | undefined,
  issues: string[],
  selectedRepairMode: FullRecipeRepairMode,
): string {
  const bounds = getRecipeStepBounds(analysis);
  const ingredients = previousOutput?.ingredients ?? [];
  const diagnostics = previousOutput
    ? getFullRecipeRepairDiagnostics(previousOutput, analysis)
    : undefined;
  const requestedIngredientIndices = issues.includes('ingredients_missing_amounts')
    ? diagnostics?.ingredientIndicesMissingAmounts ?? []
    : [];
  const requestedStepIndices = [...new Set([
    ...(issues.includes('step_missing_time_or_completion_cue')
      ? diagnostics?.stepsMissingCompletionCue ?? [] : []),
    ...(issues.includes('step_uses_unlisted_ingredients')
      ? diagnostics?.stepsUsingUnlistedIngredientIndices ?? [] : []),
  ])].sort((a, b) => a - b);
  const promptDiagnostics = selectedRepairMode === 'indexed'
    ? diagnostics
    : diagnostics
      ? {
          stepCount: diagnostics.stepCount,
          preferredStepBounds: diagnostics.preferredStepBounds,
          ingredientsMissingAmounts: diagnostics.ingredientsMissingAmounts,
          unknownIngredients: diagnostics.unknownIngredients,
          platterCoveragePercent: diagnostics.platterCoveragePercent,
          missingPlatterComponents: diagnostics.missingPlatterComponents,
        }
      : undefined;
  const previousRecipe = previousOutput
    ? {
        title: previousOutput.title,
        ingredients: previousOutput.ingredients,
        equipment: previousOutput.equipment,
        steps: previousOutput.steps.map((step, stepIndex) => {
          const content = typeof step === 'string'
            ? { title: '', step }
            : {
                title: step.title,
                step: getProviderStepText(step),
                ...(step.doneWhen ? { doneWhen: step.doneWhen } : {}),
                ...(step.safetyNote ? { safetyNote: step.safetyNote } : {}),
              };
          return selectedRepairMode === 'indexed'
            ? { stepIndex, ...content }
            : content;
        }),
        prepTime: previousOutput.prepTime,
        cookTime: previousOutput.cookTime,
        totalTime: previousOutput.totalTime,
        servings: previousOutput.servings,
        skillLevel: previousOutput.skillLevel || previousOutput.difficulty,
        nutritionEstimate: previousOutput.nutritionEstimate,
      }
    : {};
  const contractInstructions = selectedRepairMode === 'indexed'
    ? [
        'Selected repair contract: indexed. Return ONLY a minified object whose only allowed keys are ingredientCorrections and stepCorrections. Include only correction arrays that are required. Never return complete ingredients or steps arrays.',
        `Required ingredient correction indices (zero-based): ${JSON.stringify(requestedIngredientIndices)}. Return each exactly once and no other ingredient index. Preserve the ingredient concept and add an explicit usable quantity; "for dusting", "for garnish", and "as needed" are not quantities.`,
        `Required step correction indices (zero-based): ${JSON.stringify(requestedStepIndices)}. Return each exactly once and no other step index. Every correction must materially change that step and resolve all completion and ingredient-closure defects on it.`,
        'Indexed shapes: {"ingredientIndex":3,"value":"2 tbsp cornstarch, for dusting"} and {"stepIndex":3,"title":"short action","step":"cookable instruction","doneWhen":"specific completion cue","safetyNote":"required food-safety rule when applicable"}. Indices are zero-based. Do not add, remove, or reorder recipe steps.',
        'INGREDIENT LOCK: use the canonical list below as the only allowed vocabulary, but return only requested indexed corrections. Amounts may change only for requested quantity defects.',
      ]
    : [
          'Selected repair contract: whole recipe regeneration. Return ONLY the entire corrected recipe object with title, ingredients, equipment, steps, prepTime, cookTime, totalTime, servings, skillLevel, and nutritionEstimate.',
      ];
  return [
    `Correct the previous recipe JSON for "${analysis.dishName}".`,
    `Exact validation failures: ${issues.join(', ')}.`,
    ...contractInstructions,
    'Fix every listed problem. Every active cooking instruction must contain a specific time, temperature, or concrete sensory cue such as golden, tender, bubbling, thickened, or aromatic.',
    'Never use vague completion language such as "until done", "until ready", or "cook thoroughly". Do not add a cue to non-cooking actions such as gathering ingredients, plating, garnishing, serving, or dividing into bowls unless that same step also cooks food.',
    `Use at least ${bounds.min} steps and preferably no more than ${bounds.max}; keep each instruction under 30 words. A presentation-only final step may simply serve or plate the finished dish.`,
    'INGREDIENT CLOSURE IS MANDATORY: every ingredient named in an instruction must appear in the locked top-level ingredient list with an exact usable amount.',
    'Safety is mandatory: poultry 165°F/74°C; ground meat 160°F/71°C; pork and cooked fish 145°F/63°C. Raw-fish dishes must specify sushi-grade or previously frozen fish kept cold.',
    `Validation diagnostics: ${JSON.stringify(promptDiagnostics ?? {})}`,
    `Full canonical ingredient list from the previous recipe: ${JSON.stringify(ingredients)}`,
    `Complete previous recipe object: ${JSON.stringify(previousRecipe)}`,
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

function getFullRecipeRepairDiagnostics(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
) {
  const stepCompletionIndices = getInvalidCompletionStepIndices(output.steps);
  const ingredientMentionDiagnostics = getIngredientMentionDiagnostics(
    output.steps.map(getProviderStepText),
    output.ingredients,
  );
  const stepsUsingUnlistedIngredientIndices = output.steps
    .map((step, stepIndex) => getUnlistedStepIngredientText(
      [getProviderStepText(step)],
      output.ingredients,
    ).length > 0 ? stepIndex : -1)
    .filter((stepIndex) => stepIndex >= 0);
  const coverage = isGenuinePlatterMeal(analysis)
    ? getRecipeComponentCoverage(
        (analysis.detectedComponents ?? []).map((component) => component.name),
        [
          output.title,
          ...output.ingredients.map(canonicalIngredientName),
          ...output.steps.map(getProviderStepText),
        ],
      )
    : { coveragePercent: 100, missingComponents: [] as string[] };

  return {
    stepCount: output.steps.length,
    preferredStepBounds: getRecipeStepBounds(analysis),
    ingredientIndicesMissingAmounts: output.ingredients
      .map((ingredient, ingredientIndex) =>
        hasUsableIngredientAmount(ingredient) ? -1 : ingredientIndex)
      .filter((ingredientIndex) => ingredientIndex >= 0),
    ingredientsMissingAmounts: output.ingredients.filter(
      (ingredient) => !hasUsableIngredientAmount(ingredient),
    ),
    stepsMissingCompletionCue: stepCompletionIndices,
    stepsUsingUnlistedIngredientIndices,
    unknownIngredients: ingredientMentionDiagnostics.unresolvedIngredientMentions,
    suppressedNestedIngredientMentions:
      ingredientMentionDiagnostics.suppressedNestedIngredientMentions,
    presentationOnlyStepIndices: getPresentationOnlyStepIndices(output.steps),
    platterCoveragePercent: coverage.coveragePercent,
    missingPlatterComponents: coverage.missingComponents,
  };
}

function logFullRecipeValidationDetails(
  input: { analysis: FoodImageAnalysis } & Partial<ScanExecutionContext>,
  output: OpenRouterRecipeOutput,
  issues: string[],
): void {
  console.log('[recipe_validation_details]', {
    requestId: input.requestId,
    issues,
    ...getFullRecipeRepairDiagnostics(output, input.analysis),
  });
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  model: string;
  stage?: string;
  quota: ProviderQuota;
} & Partial<ScanExecutionContext>) {
  throwIfScanCancelled(input.signal, input.deadlineAt);
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

  const operation = input.stage ?? 'unknown';
  const reservation = await input.quota.reserveAttempt({
    provider: input.config.provider,
    model: input.model,
    operation,
  });
  const controller = new AbortController();
  const remainingMs = getRemainingScanMs(input.deadlineAt);
  const attemptTimeoutMs = Math.min(input.config.timeoutMs, remainingMs ?? input.config.timeoutMs);
  let providerTimedOut = false;
  const timeout = setTimeout(() => {
    providerTimedOut = true;
    controller.abort();
  }, Math.max(1, attemptTimeoutMs));
  const cancelFromScan = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener('abort', cancelFromScan, { once: true });
  const startedAt = Date.now(); // [scan_timing] per-call latency
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let actualCostUsd: number | undefined;

  try {
    throwIfScanCancelled(input.signal, input.deadlineAt);
    recordProviderAttempt(input.timing);
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
        requestId: input.requestId,
        model: input.model,
        stage: input.stage ?? 'unknown',
        status: response.status,
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
    const providerCost = (usage as Record<string, unknown> | undefined)?.cost;
    inputTokens = promptTokens;
    outputTokens = completionTokens;
    actualCostUsd = typeof providerCost === 'number' ? providerCost : undefined;
    logOpenRouterDebug('openrouter_response_shape', responseShape);
    console.log('[token_usage]', {
      requestId: input.requestId,
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
    logOpenRouterDebug('api_openrouter_response_text', { length: assistantText.length });
    const parsed = parseJsonContent(
      assistantText,
      input.config,
      input.model,
      responseShape.finishReason,
    );
    await input.quota.completeAttempt(reservation, {
      outcome: 'success',
      inputTokens,
      outputTokens,
      actualCostUsd,
    });
    if (input.requestId) {
      logScanMetric({
        requestId: input.requestId,
        stage: `provider_${input.stage ?? 'unknown'}`,
        durationMs: Date.now() - startedAt,
        details: {
          model: input.model,
          inputTokens,
          outputTokens,
        },
      });
    }
    return parsed;
  } catch (error) {
    await input.quota.completeAttempt(reservation, {
      outcome: 'failure',
      failureCategory: getProviderAttemptFailureCategory(error),
      inputTokens,
      outputTokens,
      actualCostUsd,
    });
    if (input.requestId) {
      logScanMetric({
        requestId: input.requestId,
        stage: `provider_${input.stage ?? 'unknown'}`,
        durationMs: Date.now() - startedAt,
        status: input.signal?.aborted ? 'cancelled' : 'failure',
        details: {
          model: input.model,
          reason: getProviderAttemptFailureCategory(error),
        },
      });
    }
    throwIfScanCancelled(input.signal, input.deadlineAt);
    if (error instanceof OpenRouterProviderError) {
      throw error;
    }

    if (providerTimedOut || isAbortError(error)) {
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
    input.signal?.removeEventListener('abort', cancelFromScan);
  }
}

function getProviderAttemptFailureCategory(error: unknown): string {
  if (error instanceof ScanDeadlineExceededError) return 'scan_deadline_exceeded';
  if (error instanceof ScanCancelledError) return 'scan_cancelled';
  if (error instanceof OpenRouterProviderError) return error.failure.reason;
  if (isAbortError(error)) return 'openrouter_timeout';
  if (error instanceof TypeError) return 'openrouter_network_error';
  return 'openrouter_unknown_error';
}

// ─── Model failover and backoff ───────────────────────────────────────────────

type CallJsonBase = {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  stage?: string;
  quota: ProviderQuota;
} & Partial<ScanExecutionContext>;

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

async function callOpenRouterJsonWithFailover(base: CallJsonBase, models: string[]): Promise<unknown> {
  recordLogicalProviderCall(base.timing);
  let lastError: unknown = new Error('recipe_model_chain_empty');
  let failoverCount = 0;
  const chainStartedAt = Date.now();
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    throwIfScanCancelled(base.signal, base.deadlineAt);
    logOpenRouterDebug('recipe_model_attempt', { model, attempt: i + 1, stage: base.stage });
    try {
      const result = await callOpenRouterJson({ ...base, model });
      if (i > 0) {
        logOpenRouterDebug('recipe_model_success', { model, attempt: i + 1, stage: base.stage });
      }
      console.log('[failover_summary]', {
        requestId: base.requestId,
        stage: base.stage,
        succeededAt: model,
        attemptNumber: i + 1,
        failoverCount,
        durationMs: Date.now() - chainStartedAt,
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
        logRetryMetric(base, base.stage ?? 'provider_failover', info?.reason ?? 'unknown', model);
        logOpenRouterDebug('recipe_model_fallback', { from: model, to: models[i + 1], attempt: i + 2, stage: base.stage });
        if (isBackoffError(error)) {
          await waitForScanDelay(
            RECIPE_FAILOVER_DELAYS_MS[i] ?? RECIPE_FAILOVER_DELAYS_MS[RECIPE_FAILOVER_DELAYS_MS.length - 1],
            base.signal,
            base.deadlineAt,
          );
        }
      }
    }
  }
  console.log('[failover_summary]', {
    requestId: base.requestId,
    stage: base.stage,
    succeededAt: null,
    attemptNumber: models.length,
    failoverCount,
    durationMs: Date.now() - chainStartedAt,
    status: 'failure',
  });
  throw lastError;
}

const compactVisionJsonContract = '{"scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "confidenceReason": string}';
const visionJsonContract = compactVisionJsonContract;

function getVisionPrompt(
  image: ScanImageMetadata | undefined,
  mode: RecipeMode,
  compactRecipeEnabled = false,
) {
  const contract = compactRecipeEnabled ? compactVisionJsonContract : visionJsonContract;
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
    'Never present food identification or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    ...(!compactRecipeEnabled ? [`Requested recipe mode: ${mode}.`] : []),
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getCompactVisionRetryPrompt(
  image: ScanImageMetadata | undefined,
  mode: RecipeMode,
  compactRecipeEnabled = false,
) {
  return [
    'Analyze this image for Okyo. Food and drinks are valid scans.',
    'Return ONLY valid JSON. No markdown. No explanation.',
    'Use exactly this JSON shape:',
    compactRecipeEnabled ? compactVisionJsonContract : visionJsonContract,
    'First decide whether visible food or drink exists. If no food or drink is visible, use scanState not_food. If the photo is too blurry or dark to identify anything, use too_unclear.',
    'If any food or drink is visible, do not hard reject. Give the most specific honest dish or drink name supported by the image, with lower confidence if uncertain.',
    'Drinks must be named as drinks, such as smoothie, latte, shake, juice, boba, coffee, or matcha. Never call a drink a plate or bowl.',
    'Avoid generic names like Food Plate, Restaurant Plate, Meal, Dish, Bowl, Drink, or Unknown Dish when a more specific visible guess is possible.',
    ...(!compactRecipeEnabled ? [`Requested recipe mode: ${mode}.`] : []),
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getFocusedVisionRetryPrompt(
  image: ScanImageMetadata | undefined,
  mode: RecipeMode,
  firstOutput: z.infer<typeof openRouterVisionOutputSchema>,
  compactRecipeEnabled = false,
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
    compactRecipeEnabled ? compactVisionJsonContract : visionJsonContract,
    'Name the MOST SPECIFIC dish or drink the image supports, built from visible components: descriptor + main item, like "Berry Smoothie", "Iced Matcha Latte", "Creamy Tomato Pasta", "Cheeseburger", "Grilled Chicken Rice Bowl", or "Chocolate Cake".',
    'If the image shows a drink in a cup or glass (smoothie, milkshake, latte, iced coffee, juice, boba), the dishName MUST say so. Never call a drink a plate, bowl, or meal.',
    'Generic names like "Mixed Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", or "Bowl" are wrong when any specific food or drink is identifiable. Prefer a specific guess with lower confidence.',
    'Include 2-4 possibleDishNames that are specific alternates of the same visible food or drink.',
    'Stay honest: keep scanState accurate, lower confidence instead of inventing details, and use not_food only when no food or drink is visible at all.',
    ...(!compactRecipeEnabled ? [`Requested recipe mode: ${mode}.`] : []),
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getRecipePrompt(
  analysis: FoodImageAnalysis,
  mode: RecipeMode = 'Restaurant Copy',
) {
  const isUncertainFood = analysis.scanState === 'food_present_uncertain_dish' || analysis.scanState === 'partial_food';
  const isPlatter = isGenuinePlatterMeal(analysis);
  const isBakeryOrDessert = /\b(cream bun|custard|bao bun|milk bun|brioche|donut|doughnut|eclair|cream puff|choux|mochi|tart|cheesecake|pastry|dessert)\b/i.test(
    `${analysis.dishName} ${analysis.broadDishCategory}`,
  );
  const isDrink = isDrinkAnalysisText([
    analysis.dishName,
    analysis.broadDishCategory,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' '));
  const bounds = getRecipeStepBounds(analysis);
  const platterComponentNames = isPlatter
    ? (analysis.detectedComponents ?? []).map((c) => c.name).filter(Boolean).slice(0, 12)
    : [];

  return [
    `Create one safe, realistic inspired-by home recipe for "${analysis.dishName}".`,
    `The recipe MUST be a homemade version of "${analysis.dishName}" as scanned. Do not switch dishes or add alcohol.`,
    'Return ONLY one complete minified JSON object. No markdown, prose, reasoning, modes, variants, or optional enrichment.',
    'Return exactly these top-level fields: title, ingredients, equipment, steps, prepTime, cookTime, totalTime, servings, skillLevel, nutritionEstimate.',
    'nutritionEstimate must be a cautious rounded per-serving estimate shaped like {"calories":500,"proteinGrams":25,"carbohydratesGrams":55,"fatGrams":20}. Do not imply laboratory accuracy.',
    'ingredients must be plain strings, each beginning with a usable exact quantity and real grocery name, for example "2 large eggs" or "1 tbsp olive oil". Never use ingredient objects, "some", "as needed", or a bare name. "To taste" is allowed only for salt, pepper, acid, or hot sauce.',
    'steps must be objects shaped like {"title":"short action","step":"concise cookable instruction","doneWhen":"optional useful sensory cue","safetyNote":"required only for food-safety hazards"}. Do not generate step numbers, phases, per-step ingredient arrays, or per-step tool arrays; Okyo derives those locally.',
    `Use ${bounds.min}-${bounds.max} concise steps for this dish and keep each instruction under 30 words. Every cooking instruction must contain a time, an observable completion cue, or both. A presentation-only final step may simply serve or plate the finished dish.`,
    'Name actual ingredients and actions. Never say "main ingredient", "cook until done", "prepare ingredients", "mix everything", or "season to taste" without an amount.',
    'Ingredient closure is mandatory: every ingredient used in any instruction must appear in the top-level ingredient list with a usable quantity.',
    'Unmeasured tap water used only to boil, rinse, wash, or make an ice bath may be omitted from ingredients. Any measured water incorporated into the food must be listed with its quantity.',
    'Choose one coherent strategy: either shortcut ingredients or from-scratch ingredients, never both. Never list the finished dish as an ingredient.',
    'If raw components need preparation, include those actions before cooking. Quantities used in steps must agree with the ingredient list.',
    'Keep equipment compact and include only tools genuinely required.',
    'Safety is mandatory: poultry 165°F/74°C; ground meat 160°F/71°C; pork and cooked fish 145°F/63°C. Raw-fish dishes must specify sushi-grade or previously frozen fish kept cold. Put the applicable rule in safetyNote on the relevant step.',
    isPlatter
      ? `Cover at least 90% of these detected components in the flat ingredient list and cooking steps: ${platterComponentNames.join(', ') || 'every distinct visible component'}.`
      : '',
    'PROTEIN REALISM: Never use "shark" for a fish-shaped or ambiguous fried item — use "white fish fillets". Use common grocery-store proteins (cod, tilapia, chicken, ground pork). Do not infer exotic animals from novelty-shaped food.',
    'MUSUBI FORMAT: Spam musubi = rectangular rice block + Spam slice on top + nori strip wrapped around the outside. It is NOT rolled sushi. Never create roll-slicing, bamboo mat, or "slice rolls" steps for musubi. Name it "Spam Musubi". Steps must follow: cook rice → season rice → sear Spam → make glaze → cut nori strips → shape rice blocks → assemble → serve. Max 8 steps.',
    'MANGO STICKY RICE FORMAT: Ingredients MUST be exactly: sticky rice (glutinous), ripe mangoes, coconut milk (ONE can only — never both coconut milk AND coconut cream as separate items), sugar, salt. Optional: sesame seeds or toasted coconut flakes. MAX 7 ingredients total. Never list "coconut sauce" AND "coconut cream" as separate ingredients — they are the same thing. Never list "ripe mangoes" AND "diced mango" — pick one. Steps: soak/rinse rice → steam rice → warm coconut milk + sugar + salt → fold sauce into rice → slice mango → plate and drizzle. Max 7 steps.',
    'SIMPLE FOODS: Plain fruit (watermelon cubes, berries, grapes, banana, sliced melon) = the fruit itself only. Do NOT add feta, mint, honey, nuts, granola, yogurt, dressing, or any chef addition unless clearly visible in the scan or named in the title. Watermelon cubes → ["4 cups watermelon, cubed"], optionally ["1 lime", "1/4 tsp Tajín or salt"]. Never create a salad from a plain fruit scan. Same rule for plain boiled eggs and plain toast.',
    isDrink
      ? 'DRINK: title must identify the drink. Use measure, blend or brew, taste, adjust, pour, and garnish as appropriate. Do not use oven, skillet, or meat-temperature language.'
      : '',
    ...(mode === 'Budget' && isBakeryOrDessert
      ? ['BUDGET SHORTCUT: Use store-bought or premade base (soft buns, Hawaiian rolls, bao buns, premade pastry shells). Focus on filling, cream, and simple assembly — not from-scratch dough, steaming, or professional shaping.']
      : []),
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
  ].join('\n');
}

async function parseResponseJson(response: Response, config: AiConfig, model: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    // A request-timeout abort can fire mid-body-read and surface here. We keep the
    // 'invalid_json' reason on purpose so the one targeted recipe repair can
    // run (provider timeouts remain non-repairable),
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
  quota: ProviderQuota;
  requestId: string;
  signal?: AbortSignal;
  deadlineAt?: number;
  timing?: ScanExecutionContext['timing'];
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
      quota: input.quota,
      requestId: input.requestId,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
      timing: input.timing,
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
  quota: ProviderQuota;
} & Partial<ScanExecutionContext>): Promise<ComponentRepairOutput> {
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
      quota: input.quota,
      requestId: input.requestId,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
      timing: input.timing,
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

function logRetryMetric(
  input: Partial<ScanExecutionContext>,
  stage: string,
  reason: string,
  model?: string,
): void {
  if (stage.includes('repair')) {
    recordRepairReasons(input.timing, reason);
  }
  if (!input.requestId) return;
  logScanMetric({
    requestId: input.requestId,
    stage: 'retry_or_repair',
    durationMs: 0,
    details: { retryStage: stage, reason, model },
  });
}
