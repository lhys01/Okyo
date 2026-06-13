import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import type { RecipeMode, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
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
const recipeModeOutputSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);

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
});

const recipeStepSchema = z.object({
  text: z.string().optional().default(''),
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
  mainIngredientsSummary: flexibleText,
  equipment: z.array(z.string()).optional().default([]),
  bestFor: flexibleText,
  ingredients: z.array(z.string()).optional().default([]),
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
  avoidMistake: flexibleText,
  mistakeWarning: flexibleText,
  substitutions: z.array(z.string()).optional().default([]),
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
  spicePairings: z.array(z.string()).optional().default([]),
  cookingTerms: z.array(z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  })).optional().default([]),
  pantryNote: flexibleText,
  prepTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  cookTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  totalTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  activeTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  servings: z.union([z.number(), z.string()]).optional(),
  skillLevel: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
});

export const openRouterRecipeOutputSchema = z.object({
  selectedMode: recipeModeOutputSchema.optional(),
  restaurantCopy: recipeVariantSchema.optional().default({}),
  budget: recipeVariantSchema.optional().default({}),
  healthy: recipeVariantSchema.optional().default({}),
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
    await waitBeforeRetry();
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
  // generic or contradicts visible drink clues. Failures keep the first result.
  try {
    const retryOutput = await callVisionOnce(
      input,
      getFocusedVisionRetryPrompt(input.image, input.mode, firstOutput),
      'vision_quality_retry',
    );
    const retryQuality = evaluateVisionQuality(retryOutput);
    const useRetry = retryQuality.foodVisible && !retryQuality.generic && !retryQuality.drinkMismatch;
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

// Short pause before retrying so rate-limited calls get a fresh window.
function waitBeforeRetry(ms = 1500) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
        content: 'You are Okyo, a cautious food analysis assistant. Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
      },
      {
        role: 'user',
        content,
      },
    ],
    model: input.config.openRouterVisionModel,
    maxTokens: Math.min(input.config.maxOutputTokens, 1800),
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
  const needsRetry = foodVisible && (drinkMismatch || lowVisibleFoodConfidence || (generic && confidencePercent < 88));

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

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode: RecipeMode;
}) {
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
    firstOutput = await callRecipeStage(input, getRecipePrompt(input.analysis, input.mode), 3600, 'recipe');
  } catch (firstError) {
    const shouldRetry = firstError instanceof OpenRouterProviderError &&
      retryReasons.includes(firstError.failure.reason);

    if (!shouldRetry) {
      throw firstError;
    }

    logOpenRouterDebug('openrouter_recipe_retry', {
      firstReason: firstError.failure.reason,
      model: input.config.openRouterTextModel,
      retryPrompt: 'compact',
      retryMaxTokens: 2200,
    });

    await waitBeforeRetry();
    return await callRecipeStage(input, getCompactRecipeRetryPrompt(input.analysis, input.mode), 2200, 'recipe_retry');
  }

  // Quality gate: even valid JSON can be too vague to cook from. One focused
  // repair pass, then keep whichever output is cleaner. The deterministic
  // sanitizer in aiService is still the final safety net after this.
  const issues = getRecipeQualityIssues(firstOutput, input.mode, isDrink);
  if (issues.length === 0) {
    return firstOutput;
  }

  logOpenRouterDebug('openrouter_recipe_quality_check', {
    dishName: input.analysis.dishName,
    issues,
    willRepair: true,
  });

  try {
    await waitBeforeRetry();
    const repaired = await callRecipeStage(
      input,
      getRecipeRepairPrompt(input.analysis, input.mode, firstOutput, issues),
      3600,
      'recipe_quality_repair',
    );
    const repairedIssues = getRecipeQualityIssues(repaired, input.mode, isDrink);
    logOpenRouterDebug('openrouter_recipe_quality_repair_result', {
      beforeIssues: issues,
      afterIssues: repairedIssues,
      usedRepair: repairedIssues.length < issues.length,
    });
    return repairedIssues.length < issues.length ? repaired : firstOutput;
  } catch (repairError) {
    logOpenRouterDebug('openrouter_recipe_quality_repair_failed', {
      reason: repairError instanceof OpenRouterProviderError ? repairError.failure.reason : 'unknown',
    });
    return firstOutput;
  }
}

async function callRecipeStage(
  input: { analysis: FoodImageAnalysis; config: AiConfig; mode: RecipeMode },
  userPrompt: string,
  maxTokens: number,
  stage: string,
): Promise<OpenRouterRecipeOutput> {
  const json = await callOpenRouterJson({
    config: input.config,
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a recipe assistant. Return ONLY valid JSON. No markdown. No reasoning. No explanations.',
      },
      { role: 'user', content: userPrompt },
    ],
    model: input.config.openRouterTextModel,
    maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
    stage,
  });

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
function getRecipeQualityIssues(output: OpenRouterRecipeOutput, mode: RecipeMode, isDrink: boolean): string[] {
  const variant = output[getModeKey(mode)];
  const issues: string[] = [];
  if (!variant) {
    return ['missing_variant'];
  }

  const ingredients = (Array.isArray(variant.ingredients) ? variant.ingredients : [])
    .map((value) => (typeof value === 'string' ? value : '').trim())
    .filter(Boolean);
  const stepTexts = (Array.isArray(variant.steps) ? variant.steps : [])
    .map((value) => (typeof value === 'string' ? value : value?.text ?? '').trim())
    .filter(Boolean);
  const allText = `${variant.title ?? ''} ${variant.description ?? ''} ${ingredients.join(' ')} ${stepTexts.join(' ')}`.toLowerCase();

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
  mode: RecipeMode,
  badOutput: OpenRouterRecipeOutput,
  issues: string[],
): string {
  const modeKey = getModeKey(mode);

  return [
    `Your previous recipe JSON for "${analysis.dishName}" had quality problems: ${issues.join(', ')}.`,
    'Rewrite it so a beginner can cook it with zero guessing. Return ONLY valid minified JSON, same shape as before.',
    `Return exactly: {"selectedMode":"${mode}","${modeKey}":{...recipe fields...}}`,
    'Fix every problem: NEVER write "the main ingredient" or "main ingredient" — name the actual food. Every ingredient must start with an exact amount and a real grocery name. Every step must name real ingredients with amounts, a time, and a visual cue. No "cook until done", "prepare the ingredients", "season to taste", or "mix everything".',
    'Keep 6-12 ingredients and 8-14 steps (6-8 for drinks or salads).',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients.slice(0, 5),
      likelyIngredients: analysis.likelyIngredients.slice(0, 5),
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

  try {
    const response = await fetch(openRouterEndpoint, {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model: input.model,
        // Keep reasoning models from spending the whole budget thinking.
        // OpenRouter ignores this for models without reasoning support.
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
      throw createOpenRouterError(input.config, input.model, 'openrouter_http_error', {
        httpStatus: response.status,
        openRouterErrorMessage: await getOpenRouterErrorMessage(response),
      });
    }

    const responseJson = await parseResponseJson(response, input.config, input.model);
    const responseShape = getOpenRouterResponseShape(responseJson);
    logOpenRouterDebug('openrouter_response_shape', responseShape);
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

const visionJsonContract = '{"scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}';

function getVisionPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  return [
    'Analyze this real-world restaurant, cafe, or takeout food or drink photo for a testing-only Okyo prototype.',
    'Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
    'Return JSON only with exactly these fields:',
    visionJsonContract,
    'First decide: is this food, a drink, or neither? Drinks count as scannable: smoothies, milkshakes, lattes, iced coffee, matcha, juices, lemonade, boba/bubble tea, and hot chocolate are all valid results, as are soups, desserts, and pastries.',
    'If any visible food or drink exists, do not hard reject. Ignore table clutter, plates, utensils, hands, napkins, packaging, captions, UI chrome, and restaurant background unless they help identify the food or drink.',
    'Real restaurant photos are allowed to be messy: dim lighting, busy tables, multiple items, dark or charred food, shiny sauce, garnish, angled phone photos, partial plates, takeout containers, screenshots of food posts, hands, cups, napkins, menus, utensils, and cluttered backgrounds are normal.',
    'Ignore plates, utensils, table surfaces, cups, napkins, hands, menus, packaging, captions, UI chrome, and background unless they help identify the food. Focus on edible food.',
    'If multiple dishes are visible, choose the largest or most central edible item. Identify the central plate or central food pile; do not reject because side plates or clutter are present.',
    'If the exact dish is uncertain, identify a broad useful food category and give a lower-confidence best guess. Use broad category names instead of failure.',
    'Do not reject just because food is dark, charred, saucy, cluttered, garnished, partially visible, cropped, or photographed at an angle. Return lower confidence instead.',
    'dishName must be the MOST SPECIFIC name the image supports, built from what is visible. Examples: purple blended drink in a cup -> "Berry Smoothie"; green iced drink -> "Iced Matcha Latte"; creamy red-sauced pasta -> "Creamy Tomato Pasta"; burger with melted cheese -> "Cheeseburger"; bowl of rice with grilled chicken -> "Grilled Chicken Rice Bowl"; layered cake slice -> "Chocolate Cake".',
    'Generic names like "Mixed Restaurant Plate", "Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", "Bowl", "Drink", or "Unknown Dish" are WRONG whenever any specific food or drink is identifiable. Prefer a specific guess with lower confidence over a generic name. Only use a broad name like "Mixed Restaurant Plate" when the image truly shows several distinct meal components on one platter and no single dish dominates.',
    'The dishName must match the visible components. If the image shows a drink in a cup or glass (smoothie, latte, shake, juice), the dishName must say smoothie/latte/shake/juice — never call a drink a plate or bowl.',
    'Set broadDishCategory to one of: pizza, pasta/noodles, rice bowl, burger/sandwich, tacos/wrap, grilled meat, fried food, seafood, salad, soup/stew, dessert, breakfast item, drink/beverage, mixed platter, unknown food dish.',
    'Identify cuisine only when there are strong visual clues. Otherwise use "Restaurant-style".',
    'Use visibleComponents to describe visible protein, sauce, base/starch, vegetables, toppings/garnish, and cooking method. Empty string is okay when not visible.',
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

function getModeKey(mode: RecipeMode) {
  return mode === 'Budget' ? 'budget' : mode === 'Healthy' ? 'healthy' : 'restaurantCopy';
}

function getRecipePrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  const modeKey = getModeKey(mode);
  const isUncertainFood = analysis.scanState === 'food_present_uncertain_dish' || analysis.scanState === 'partial_food';
  const isDrink = isDrinkAnalysisText([
    analysis.dishName,
    analysis.broadDishCategory,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' '));

  return [
    `Create a compact inspired-by homemade recipe JSON for "${analysis.dishName}" in the ${mode} mode only.`,
    `The recipe MUST be a homemade version of "${analysis.dishName}" as scanned. Do not switch to a different dish, drink, or cocktail. No alcohol.`,
    'Return ONLY valid minified JSON. No markdown, no prose, no reasoning, no extra text.',
    `Return exactly: {"selectedMode":"${mode}","${modeKey}":{...recipe fields...}}`,
    `Include ONLY "selectedMode" and "${modeKey}". Do NOT include other mode keys.`,
    'Recipe fields: title, description, mainIngredientsSummary, equipment, bestFor, ingredients, steps, avoidMistake, substitutions, storageAndReheating, pantryNote, prepTime, cookTime, totalTime, servings, skillLevel, groceryItems, spicePairings.',
    'Strict limits: ingredients 6-12, steps 8-14 (plain strings), substitutions max 3, equipment max 5, groceryItems max 10, spicePairings max 2.',
    'BANNED WORDING (never use, anywhere — title, ingredients, steps, notes): "the main ingredient", "main ingredient", standalone "protein", standalone "vegetables", standalone "sauce", standalone "seasoning", "toppings", "cook until done", "prepare the ingredients", "mix everything", "season to taste" with no amount. Always name the actual food or an honest best guess (e.g. "chicken breast", "ground beef", "rigatoni", "blueberries", "romaine lettuce", "tomato sauce").',
    'Ingredients: each is one string that starts with an exact amount, then a normal grocery-store name, like "8 oz rigatoni", "1 tablespoon olive oil", "2 cloves garlic, minced", "1/2 cup tomato sauce". Order them by when they are used. Add a prep note when needed ("2 cloves garlic, minced"). "sauce" alone is banned — name it ("1/2 cup tomato sauce", "1/4 cup soy-ginger sauce"). "protein" alone is banned — name it ("chicken breast", "a burger patty"). Every ingredient that needs cooking must appear in the steps.',
    'Steps: write for a total beginner. Each step is one plain string under 30 words, starts with an action verb, and covers ONE action. Name the real ingredient by name and repeat its exact amount when it is added. Include pan heat level, time, and a visual cue, like "Add the diced onion and cook for 3-4 minutes, stirring often, until soft and lightly golden."',
    'Never write vague steps like "Cook the main ingredient", "Make the sauce", "Cook until done", "Prepare the ingredients", "Add the vegetables", or "Season to taste". Say exactly what to do, for how long, and what it should look/smell/feel like.',
    'Very simple dishes (salads, sandwiches, toast, drinks) may use 6-8 steps instead. Do not pad with filler steps.',
    isDrink
      ? 'This is a DRINK. The title must say smoothie/latte/shake/juice/etc. Write drink-making steps only: measure, blend or brew, taste, adjust thickness or sweetness, pour, garnish. No oven, no skillet, no meat, no meat temperatures. Ingredients must fit a drink: fruit, milk or yogurt or a dairy-free swap, ice, juice, espresso or matcha or cocoa if visible, sweetener.'
      : 'Meat and seafood steps must include the safe internal temperature: 165°F/74°C chicken, 160°F/71°C ground meat, 145°F/63°C pork or fish.',
    'groceryItems use store-buyable units: {"name":"heavy cream","quantity":"1 small carton","category":"Dairy"}.',
    'Text limits: description 1-2 sentences. avoidMistake 1 sentence. storageAndReheating 1 sentence. pantryNote 1 sentence.',
    'Never use the word copycat. Use inspired-by or restaurant-style.',
    'Grocery categories: Produce, Protein, Bakery / Bread, Dairy, Sauces / Condiments, Pantry, Spices, Noodles / Grains, Garnish.',
    'No nutrition claims. No unsafe cooking advice. Never call it official.',
    isUncertainFood
      ? 'Scan is uncertain — make a flexible best-guess inspired-by version based only on visible components.'
      : 'Scan is clear — keep wording honest and inspired-by.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      scanState: analysis.scanState,
      visibleIngredients: analysis.visibleIngredients.slice(0, 5),
      likelyIngredients: analysis.likelyIngredients.slice(0, 5),
      visibleComponents: analysis.visibleComponents,
    })}`,
  ].join('\n');
}

function getCompactRecipeRetryPrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  const modeKey = getModeKey(mode);

  return [
    'JSON only. No markdown. No explanations. Write real recipe text in every field; never output placeholder dots.',
    `Return one object with two keys: "selectedMode" set to "${mode}", and "${modeKey}" set to a recipe object.`,
    `The "${modeKey}" recipe object has: title (string), description (1 sentence), ingredients (6 strings, each an exact amount plus grocery name like "8 oz rigatoni"), steps (6-8 plain strings, each under 22 words, beginner-friendly with time and visual cue), prepTime, cookTime, totalTime, servings (number), skillLevel, avoidMistake (1 sentence), substitutions (2 strings), storageAndReheating (1 sentence), pantryNote (1 sentence), groceryItems (empty array), spicePairings (empty array).`,
    `Dish: ${analysis.dishName}. Mode: ${mode}. Visible: ${analysis.visibleIngredients.slice(0, 4).join(', ')}.`,
  ].join('\n');
}

async function parseResponseJson(response: Response, config: AiConfig, model: string) {
  try {
    return await response.json() as unknown;
  } catch {
    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      httpStatus: response.status,
      openRouterErrorMessage: 'OpenRouter response body was not valid JSON.',
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

  return {
    hasChoices: Array.isArray(getRecord(response)?.choices),
    choiceCount: getChoiceCount(response),
    hasMessage: Boolean(message),
    contentType: getValueType(content),
    contentIsNull: content === null,
    hasReasoning: typeof message?.reasoning === 'string' && message.reasoning.length > 0,
    hasReasoningDetails: Boolean(message?.reasoning_details),
    finishReason: getFinishReason(firstChoice),
  };
}

function getFirstChoice(response: unknown): SafeRecord | undefined {
  const choices = getRecord(response)?.choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }

  return getRecord(choices[0]);
}

function getChoiceCount(response: unknown) {
  const choices = getRecord(response)?.choices;
  return Array.isArray(choices) ? choices.length : 0;
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

function getFinishReason(choice: SafeRecord | undefined) {
  const finishReason = choice?.finish_reason ?? choice?.finishReason;
  return typeof finishReason === 'string' || finishReason === null ? finishReason : undefined;
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
