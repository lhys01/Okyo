import { createHash } from 'node:crypto';

import { z } from 'zod';

import { getAiConfig } from '../config/aiConfig.js';
import type { AiConfig } from '../config/aiConfig.js';
import type {
  DetectedComponent,
  Difficulty,
  GroceryCategory,
  GroceryListItem,
  GroceryList,
  Recipe,
  CookingTerm,
  RecipeIngredient,
  RecipeIngredientGroup,
  RecipeStep,
  StepImagePromptData,
  RecipeMode,
  ScanImageMetadata,
  ScanResult,
  ScanState,
  ScanSource,
  ShareCard,
} from '../types.js';
import {
  analyzeFoodImageWithOpenRouter,
  callComponentRepairWithOpenRouter,
  generateRecipeWithOpenRouter,
  isDrinkAnalysisText,
  isGenericDishName,
  OpenRouterProviderError,
  repairStepCoachingWithAI,
  type ComponentRepairOutput,
  type OpenRouterRecipeOutput,
  type OpenRouterRecipeVariant,
  type OpenRouterVisionOutput,
  type StepCoachingPatch,
} from './openRouterProvider.js';
import {
  enforceStepIngredientClosure,
  ingredientsMatch,
} from './recipeIngredientValidation.js';
import { logScanEvaluation } from './scanEvalLogger.js';
import { recordPlatterCoverage, recordRecipeQuality } from './recipeQualityAnalytics.js';
import { getGeneratedRecipe, storeGeneratedRecipe } from '../store.js';

// Bump when the vision/recipe prompt or post-processing pipeline changes substantially.
// Any cached scan result with a different version is automatically stale.
const RECIPE_PIPELINE_VERSION = 'v3';
const SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h success cache
const SCAN_REJECTION_CACHE_TTL_MS = 60 * 60 * 1000; // 1 h rejection cache

type ScanCacheEntry =
  | { kind: 'success'; result: AiScanSuccessResult; expiresAt: number }
  | { kind: 'rejection'; error: FoodRejectionError; expiresAt: number };
// ponytail: in-memory only; add Redis/disk when multi-process deployment matters
const scanCache = new Map<string, ScanCacheEntry>();
const SCAN_CACHE_MAX_ENTRIES = 2000;

function getScanCacheKey(dataUrl: string, mode: string): string {
  return createHash('sha1').update(dataUrl).digest('hex') + ':' + mode + ':' + RECIPE_PIPELINE_VERSION;
}

// Lazily sweeps expired entries and, if still oversized, drops the oldest
// (first-inserted) entries. Called on every insert so the cache never needs
// its own timer/interval.
function sweepScanCache(): void {
  const now = Date.now();
  for (const [key, entry] of scanCache) {
    if (entry.expiresAt <= now) {
      scanCache.delete(key);
    }
  }
  if (scanCache.size > SCAN_CACHE_MAX_ENTRIES) {
    const overflow = scanCache.size - SCAN_CACHE_MAX_ENTRIES;
    const oldestKeys = [...scanCache.keys()].slice(0, overflow);
    for (const key of oldestKeys) {
      scanCache.delete(key);
    }
  }
}

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const confidenceSchema = z.number().min(0).max(1);
const matchScoreSchema = z.number().min(0).max(10);
const aiSourceSchema = z.enum(['openrouter_ai']);
const scanStateSchema = z.enum([
  'clear_food',
  'food_present_uncertain_dish',
  'partial_food',
  'not_food',
  'too_unclear',
]);
const visibleComponentsSchema = z.object({
  protein: z.string().optional().default(''),
  sauce: z.string().optional().default(''),
  baseStarch: z.string().optional().default(''),
  vegetables: z.string().optional().default(''),
  toppingsGarnish: z.string().optional().default(''),
  cookingMethod: z.string().optional().default(''),
});
const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];
const defaultRestaurantPrice = 18;
const defaultHomemadeCost = 6.5;
const uploadedImageConfidenceThreshold = 0.4;
const notFoodConfidenceThreshold = 0.78;
const foodEvidenceKeywords = [
  'pizza',
  'pasta',
  'noodle',
  'noodles',
  'rice',
  'bowl',
  'burger',
  'sandwich',
  'taco',
  'wrap',
  'meat',
  'chicken',
  'beef',
  'lamb',
  'pork',
  'fish',
  'seafood',
  'sushi',
  'salad',
  'soup',
  'stew',
  'fries',
  'bread',
  'sauce',
  'cheese',
  'vegetable',
  'vegetables',
  'garnish',
  'grilled',
  'fried',
  'roasted',
  'charred',
  'creamy',
  'spicy',
  'plate',
  'platter',
  'dessert',
  'steak',
  'skewer',
  'kebab',
  'bbq',
  'crispy',
  'stir fry',
  'stir-fry',
];

export type AiSource = z.infer<typeof aiSourceSchema>;
export type FoodScanState = z.infer<typeof scanStateSchema>;

export const foodImageAnalysisSchema = z.object({
  candidateScanId: z.string().min(1),
  aiSource: aiSourceSchema,
  dishName: z.string().min(1),
  cuisine: z.string().min(1),
  restaurantStyle: z.string().min(1),
  scanState: scanStateSchema,
  broadDishCategory: z.string().min(1),
  confidence: confidenceSchema,
  confidenceReason: z.string().min(1),
  isFoodImage: z.boolean(),
  isRestaurantMeal: z.boolean(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  possibleDishNames: z.array(z.string()).default([]),
  visibleComponents: visibleComponentsSchema,
  restaurantPriceEstimate: z.number().nonnegative(),
  homemadeCostEstimate: z.number().nonnegative(),
  matchScore: matchScoreSchema,
  difficulty: difficultySchema,
  fallbackReason: z.string().optional(),
  modes: z.array(recipeModeSchema).min(1),
  notes: z.array(z.string()).default([]),
  detectedComponents: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
    estimatedQuantity: z.number().optional(),
  })).default([]),
  // Inline Epicure suggestions returned by the vision model. When present,
  // recipe generation uses these directly without a separate Epicure API call.
  epicureSuggestions: z.object({
    complementaryIngredients: z.array(z.string()).default([]),
    healthySubstitutions: z.record(z.string()).default({}),
    budgetSubstitutions: z.record(z.string()).default({}),
  }).optional(),
});

export const generatedRecipeOutputSchema = z.object({
  recipeId: z.string().min(1),
  title: z.string().min(1),
  mode: recipeModeSchema,
  aiSource: aiSourceSchema,
  confidence: confidenceSchema,
  confidenceNote: z.string().min(1),
  fallbackReason: z.string().optional(),
});

export const ingredientCostEstimateSchema = z.object({
  restaurantPrice: z.number().nonnegative(),
  homemadeCost: z.number().nonnegative(),
  estimatedSavings: z.number(),
  confidence: confidenceSchema,
  assumptions: z.array(z.string()).default([]),
});

export type FoodImageAnalysis = z.infer<typeof foodImageAnalysisSchema>;
export type GeneratedRecipeOutput = z.infer<typeof generatedRecipeOutputSchema> & {
  recipe?: Recipe;
};
export type IngredientCostEstimate = z.infer<typeof ingredientCostEstimateSchema>;

export type AnalyzeFoodImageInput = {
  image?: ScanImageMetadata;
  source: ScanSource;
  mode: RecipeMode;
  // Set only after the request-level opt-in header + FABLE_ENABLED + daily
  // cap have already been validated upstream (server.ts). getAiConfig()
  // still requires FABLE_ENABLED itself before honoring this.
  fableActive?: boolean;
};

export type GenerateRecipeFromDishInput = {
  analysis: FoodImageAnalysis;
  mode: RecipeMode;
  fableActive?: boolean;
};

export type EstimateIngredientCostsInput = {
  analysis: FoodImageAnalysis;
  recipe: Recipe;
};

export type AiScanSuccessResult = {
  status: 'success';
  scan: ScanResult;
  recipe?: Recipe;
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note: string;
  aiSource: AiSource;
  aiProvider: 'openrouter';
  visionModel: string;
  recipeModel: string;
  fallbackReason?: string;
  confidence: number;
  scanState: ScanState;
  uploadedImage: boolean;
};

export type FoodRejectionType = 'no_food_detected' | 'unclear_food';

export class FoodRejectionError extends Error {
  readonly rejectionType: FoodRejectionType;
  readonly scanState: ScanState;
  readonly confidence: number;
  readonly dishName: string;

  constructor(args: { rejectionType: FoodRejectionType; scanState: ScanState; confidence: number; dishName: string }) {
    super("I couldn't find a clear meal in this photo. Try scanning a plated dish, snack, or restaurant food.");
    this.name = 'FoodRejectionError';
    this.rejectionType = args.rejectionType;
    this.scanState = args.scanState;
    this.confidence = args.confidence;
    this.dishName = args.dishName;
  }
}

export async function analyzeFoodImage(input: AnalyzeFoodImageInput): Promise<FoodImageAnalysis> {
  const config = getAiConfig({ fableActive: input.fableActive });

  logScanDebug('api_openrouter_call_start', {
    imageDataUrlExists: Boolean(input.image?.dataUrl),
    imageDataUrlLength: input.image?.dataUrl?.length ?? 0,
    imageUriKind: getImageUriKind(input.image),
    model: config.openRouterVisionModel,
    stage: 'vision',
  });
  logScanDebug('api_openrouter_model', { model: config.openRouterVisionModel, stage: 'vision' });
  const output = await analyzeFoodImageWithOpenRouter({
    config,
    image: input.image,
    mode: input.mode,
  });
  logAi('openrouter_ai', getAiLogDetails(config, config.openRouterVisionModel, { stage: 'vision' }));
  const normalized = normalizeVisionOutput(output);
  logScanDebug('api_scan_normalized_state', {
    dishCategory: normalized.broadDishCategory,
    confidence: normalized.confidence,
    dishName: normalized.dishName,
    foodDetected: normalized.isFoodImage,
    scanState: normalized.scanState,
    visibleComponentsCount: getVisibleComponentsCount(normalized.visibleComponents),
    visibleIngredientsCount: normalized.visibleIngredients.length,
  });
  logScanDebug('api_openrouter_vision_normalized', {
    confidence: normalized.confidence,
    dishName: normalized.dishName,
    foodDetected: normalized.isFoodImage,
    scanState: normalized.scanState,
  });

  return foodImageAnalysisSchema.parse({
    candidateScanId: `scan-${Date.now()}`,
    aiSource: 'openrouter_ai',
    confidence: normalized.confidence,
    confidenceReason: normalized.confidenceReason,
    broadDishCategory: normalized.broadDishCategory,
    cuisine: normalized.cuisine,
    difficulty: getDifficultyFromConfidence(normalized.confidence),
    dishName: normalized.dishName,
    epicureSuggestions: normalized.epicureSuggestions,
    homemadeCostEstimate: normalized.homemadeCostEstimate,
    isFoodImage: normalized.isFoodImage,
    isRestaurantMeal: normalized.isRestaurantMeal,
    likelyIngredients: normalized.likelyIngredients,
    matchScore: getMatchScoreFromConfidence(normalized.confidence),
    modes: recipeModes,
    notes: ['OpenRouter test output; verify before using.'],
    possibleDishNames: normalized.possibleDishNames,
    rejectionReason: normalized.rejectionReason,
    restaurantPriceEstimate: normalized.restaurantPriceEstimate,
    restaurantStyle: normalized.cuisine,
    scanState: normalized.scanState,
    visibleComponents: normalized.visibleComponents,
    visibleIngredients: normalized.visibleIngredients,
    detectedComponents: buildDetectedComponents(normalized.visibleIngredients, normalized.confidence),
  });
}

export async function generateRecipeFromDish(
  input: GenerateRecipeFromDishInput,
): Promise<GeneratedRecipeOutput> {
  const config = getAiConfig({ fableActive: input.fableActive });

  const startedAt = Date.now();
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: input.analysis,
      config,
      mode: input.mode,
    });
    logAi('openrouter_ai', getAiLogDetails(config, config.openRouterTextModel, { stage: 'recipe' }));
    const result = createRecipeFromOpenRouterOutput(output, input.analysis, input.mode);

    // Store recipe for deferred coaching — enriched on Guided Cooking tap, not on scan.
    if (result.recipe) {
      storeGeneratedRecipe(result.recipe);
    }

    const initialScore = result.recipe?.structuredSteps?.length
      ? calculateRecipeCoachingScore(result.recipe.structuredSteps)
      : 0;

    recordRecipeQualityForResult({
      config,
      analysis: input.analysis,
      result,
      initialScore,
      finalScore: initialScore,
      repairDelivered: false,
      generationMs: Date.now() - startedAt,
    });

    // Component coverage repair: for platter-style meals, ensure every detected
    // component appears in ingredientGroups.
    let finalResult = result;
    if (finalResult.recipe && isPlatterStyleMeal(input.analysis)) {
      finalResult = await ensureComponentCoverage(finalResult, input.analysis, config);
      if (finalResult.recipe) {
        storeGeneratedRecipe(finalResult.recipe);
      }
    }

    // Ingredient closure enforcement: recipe.ingredients is the single source
    // of truth. The provider's quality-repair pass already had one chance to
    // fix unlisted step ingredients; anything still unknown here is
    // deterministically stripped — never invented, never a scan failure.
    if (finalResult.recipe) {
      const enforced = enforceStepIngredientClosure(finalResult.recipe);
      let closedRecipe = enforced.recipe;
      if (enforced.report.missingGroceryItems.length > 0) {
        closedRecipe = {
          ...closedRecipe,
          groceryItems: getGroceryItems(closedRecipe.ingredients, input.analysis),
        };
      }
      if (enforced.changed || enforced.report.missingGroceryItems.length > 0) {
        finalResult = { ...finalResult, recipe: closedRecipe };
        storeGeneratedRecipe(closedRecipe);
      }
      if (
        enforced.report.unknownStepIngredients.length > 0 ||
        enforced.report.missingGroceryItems.length > 0
      ) {
        console.warn('[recipe_consistency]', {
          recipeId: closedRecipe.id,
          unknownStepIngredients: enforced.report.unknownStepIngredients,
          missingGroceryItems: enforced.report.missingGroceryItems,
          strippedStepIngredients: enforced.strippedStepIngredients,
          repaired: enforced.report.unknownStepIngredients.length === 0,
        });
      }
    }

    if (finalResult.recipe?.steps?.length) {
      logUnsafeCookingHeuristic(finalResult.recipe.id, finalResult.recipe.steps);
    }

    return finalResult;
  } catch (error) {
    // Fail-closed: throw on recipe generation failure. Never return a fabricated result.
    throw error;
  }
}

// Records a recipe-quality analytics event for the delivered recipe. Re-runs the
// pure warning detector on the FINAL (post-repair) steps so "common issues"
// reflect what the user actually receives. Fire-and-forget — never awaited on the
// request path, and recordRecipeQuality swallows its own errors.
function recordRecipeQualityForResult(args: {
  config: AiConfig;
  analysis: FoodImageAnalysis;
  result: GeneratedRecipeOutput;
  initialScore: number;
  finalScore: number;
  repairDelivered: boolean;
  generationMs: number;
}): void {
  const { config, analysis, result, initialScore, finalScore, repairDelivered, generationMs } = args;
  const finalSteps = result.recipe?.structuredSteps ?? [];
  const warnings = finalSteps.length > 0
    ? collectCoachingWarnings(
        finalSteps,
        analysis,
        analysis.dishName ?? '',
        result.recipe?.ingredients.map((i) => i.name),
        result.recipe?.ingredients.map((i) => ({ name: i.name, quantity: i.quantity })),
      ).warnCounts
    : {};

  void recordRecipeQuality({
    model: config.openRouterTextModel,
    dish: analysis.dishName ?? 'unknown',
    category: analysis.broadDishCategory ?? 'unknown',
    score: finalScore,
    initialScore,
    repairUsed: repairDelivered,
    repairImprovement: repairDelivered ? finalScore - initialScore : 0,
    repairSuccess: repairDelivered && finalScore > initialScore,
    compact: Boolean(result.recipe?.isCompactRecipe),
    generationMs,
    stepCount: finalSteps.length,
    warnings,
  });
}

// Generates coaching fields for a previously scanned recipe.
// Called when the user taps Guided Cooking — not during the scan itself.
// Returns null if the recipe has expired from the store (>1 day old).
export async function enrichRecipeCoaching(
  recipeId: string,
): Promise<{ structuredSteps: RecipeStep[] } | null> {
  const recipe = getGeneratedRecipe(recipeId);
  if (!recipe?.structuredSteps?.length) {
    return null;
  }

  const steps = recipe.structuredSteps;
  const weaknesses = identifyCoachingWeaknesses(steps);
  if (weaknesses.length === 0) {
    return { structuredSteps: steps };
  }

  const config = getAiConfig();
  try {
    const patches = await repairStepCoachingWithAI({
      steps,
      weaknesses,
      dishName: recipe.title,
      config,
    });
    const repairedSteps = applyCoachingPatches(steps, patches, weaknesses);
    const repairedScore = calculateRecipeCoachingScore(repairedSteps);
    const initialScore = calculateRecipeCoachingScore(steps);
    // Only return repaired steps if they didn't regress the score.
    return { structuredSteps: repairedScore >= initialScore ? repairedSteps : steps };
  } catch {
    // Fail gracefully — return uncoached steps so Guided Cooking still opens.
    return { structuredSteps: steps };
  }
}

export function estimateIngredientCosts(input: EstimateIngredientCostsInput): IngredientCostEstimate {
  const restaurantPrice = normalizeRestaurantPrice(input.analysis.restaurantPriceEstimate);
  const homemadeCost = normalizeHomemadeCost(input.recipe.estimatedHomemadeCost, restaurantPrice);
  const estimate = ingredientCostEstimateSchema.safeParse({
    restaurantPrice,
    homemadeCost,
    estimatedSavings: Math.max(0, restaurantPrice - homemadeCost),
    confidence: Math.min(input.analysis.confidence, 0.82),
    assumptions: [
      'Uses AI-shaped restaurant estimate when available.',
      'Uses AI-shaped homemade ingredient estimate when available.',
    ],
  });

  if (estimate.success) {
    return estimate.data;
  }

  throw new Error('Cost estimate validation failed');
}

export async function createAiScan(input: AnalyzeFoodImageInput): Promise<AiScanSuccessResult> {
  const config = getAiConfig({ fableActive: input.fableActive });
  const uploadedImage = hasRealUploadedImage(input);
  const providerVisible = isProviderVisibleImage(input.image);
  logScanDebug('api_scan_reliability_start', {
    source: input.source,
    uploadedImage,
    imageProviderVisible: providerVisible,
    imageConversionError: input.image?.conversionError,
    mode: input.mode,
  });
  logScanDebug('api_scan_provider_visible_start', {
    imageConversionError: input.image?.conversionError,
    imageDataUrlExists: Boolean(input.image?.dataUrl),
    imageDataUrlLength: input.image?.dataUrl?.length ?? 0,
    imageUriKind: getImageUriKind(input.image),
    placeholder: Boolean(input.image?.placeholder),
  });
  logScanDebug('api_scan_provider_visible_result', { providerVisible });
  logScanDebug('api_openrouter_call_start', {
    willCallOpenRouter: uploadedImage && providerVisible && canUseOpenRouter(config),
    aiEnabled: config.enabled,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    imageProviderVisible: providerVisible,
    model: config.openRouterVisionModel,
    stage: 'vision_guard',
  });
  logScanDebug('api_scan_create_start', {
    aiEnabled: config.enabled,
    canUseOpenRouter: canUseOpenRouter(config),
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    imageConversionError: input.image?.conversionError,
    imageDataUrlExists: Boolean(input.image?.dataUrl),
    imageDataUrlLength: input.image?.dataUrl?.length ?? 0,
    imageProviderVisible: providerVisible,
    imageUriKind: getImageUriKind(input.image),
    source: input.source,
    uploadedImage,
    visionModel: config.openRouterVisionModel,
  });

  if (uploadedImage && !canUseOpenRouter(config)) {
    const reason = getUnavailableAiReason(config);
    throw new Error(`AI_UNAVAILABLE: ${reason}`);
  }

  if (uploadedImage && !providerVisible) {
    throw new Error(`IMAGE_NOT_AVAILABLE: ${getImageUnavailableReason(input.image)}`);
  }


  // Scan-level cache: same image + mode + pipeline version returns the cached result
  // without re-running vision or recipe generation. Only keyed when a real dataUrl
  // is present; placeholder / URI-only scans fall through to live generation.
  const scanCacheKey = input.image?.dataUrl
    ? getScanCacheKey(input.image.dataUrl, input.mode)
    : null;
  if (scanCacheKey) {
    const cached = scanCache.get(scanCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[scan_cache]', { hit: true, mode: input.mode, keyPrefix: scanCacheKey.slice(0, 8), ttl: 'valid' });
      if (cached.kind === 'success') return cached.result;
      throw cached.error;
    }
    console.log('[scan_cache]', { hit: false, mode: input.mode, keyPrefix: scanCacheKey.slice(0, 8) });
  }

  // [scan_timing] orchestration timers. Per-OpenRouter-call timing is logged
  // separately by callOpenRouterJson ([token_usage].durationMs, keyed by stage);
  // this gives the end-to-end and deterministic-stage breakdown.
  const scanStartedAt = Date.now();
  try {
    const visionStartedAt = Date.now();
    const analysis = await analyzeFoodImage(input);
    const visionMs = Date.now() - visionStartedAt;
    const foodDrinkVisible = Boolean(analysis.isFoodImage || isFoodScanState(analysis.scanState));
    logScanDebug('api_scan_vision_result', {
      confidence: analysis.confidence,
      dishName: analysis.dishName,
      foodDrinkVisible,
      scanState: analysis.scanState,
    });
    logScanDebug('api_scan_food_drink_visible', {
      visible: foodDrinkVisible,
      scanState: analysis.scanState,
    });
    logScanDebug('api_scan_first_dish_name', { dishName: analysis.dishName });
    logScanDebug('api_scan_first_confidence', { confidence: analysis.confidence });

    // Hard food gate: reject non-food/unclear images before Epicure or recipe generation.
    const rejection = getFoodGateRejection(analysis, uploadedImage);
    const foodGatePassed = rejection === null;
    console.log('[food_gate]', {
      passed: foodGatePassed,
      scanState: analysis.scanState,
      confidence: analysis.confidence,
      dishName: analysis.dishName,
      visionModel: config.openRouterVisionModel,
      epicureSkipped: !foodGatePassed,
      recipeSkipped: !foodGatePassed,
    });
    if (rejection) {
      console.log('[scan_timing]', {
        dish: analysis.dishName,
        scanState: analysis.scanState,
        visionMs,
        recipeMs: 0,
        totalMs: Date.now() - scanStartedAt,
        rejected: rejection.rejectionType,
      });
      if (scanCacheKey) {
        scanCache.set(scanCacheKey, { kind: 'rejection', error: rejection, expiresAt: Date.now() + SCAN_REJECTION_CACHE_TTL_MS });
        sweepScanCache();
      }
      throw rejection;
    }

    logScanDebug('api_scan_recipe_start', {
      dishName: analysis.dishName,
      mode: input.mode,
      scanState: analysis.scanState,
    });
    const recipeStartedAt = Date.now();
    const generatedRecipe = await generateRecipeFromDish({ analysis, mode: input.mode, fableActive: input.fableActive });
    const recipeMs = Date.now() - recipeStartedAt;
    const recipeFallbackReason = generatedRecipe.fallbackReason ?? analysis.fallbackReason;
    logScanDebug('api_scan_recipe_result', {
      aiSource: generatedRecipe.aiSource,
      fallbackReason: recipeFallbackReason,
      recipeGenerated: generatedRecipe.aiSource === 'openrouter_ai' && Boolean(generatedRecipe.recipe),
      recipeId: generatedRecipe.recipeId,
    });

    if (
      uploadedImage &&
      generatedRecipe.aiSource !== 'openrouter_ai'
    ) {
      // Fail-closed: throw on recipe generation failure. Never return partial scans.
      throw new Error(`RECIPE_GENERATION_FAILED: ${recipeFallbackReason || 'unknown reason'}`);
    }

    const recipe = generatedRecipe.recipe;

    if (!recipe) {
      // Fail-closed: throw when recipe is missing. Never return partial scans.
      throw new Error('RECIPE_MISSING: Recipe object was not generated');
    }

    const costEstimate = estimateIngredientCosts({ analysis, recipe });
    const usedOpenRouterAnalysis = analysis.notes.includes('OpenRouter test output; verify before using.');
    const fallbackReason = recipeFallbackReason;
    const aiSource = 'openrouter_ai' as const;

    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const groceryListId = `grocery-${recipe.id}`;
    const shareCardId = `share-${scanId}`;

    const scan: ScanResult = {
      id: scanId,
      dishName: analysis.dishName,
      bestGuessDishName: analysis.dishName,
      bestGuessNote: getBestGuessNote(analysis),
      possibleDishNames: analysis.possibleDishNames,
      confidence: getBlendedConfidence(analysis.confidence, generatedRecipe.confidence, costEstimate.confidence),
      difficulty: analysis.difficulty,
      estimatedSavings: costEstimate.estimatedSavings,
      homemadeCost: costEstimate.homemadeCost,
      matchScore: analysis.matchScore,
      modes: analysis.modes,
      restaurantPrice: costEstimate.restaurantPrice,
      restaurantStyle: analysis.restaurantStyle,
      scanState: analysis.scanState,
      recipeId: recipe.id,
      groceryListId,
      shareCardId,
    };

    const groceryList = getGroceryListForRecipe(recipe);
    const shareCard: ShareCard = {
      id: shareCardId,
      scanResultId: scanId,
      kind: 'scan-result',
      headline: `${analysis.dishName} for $${costEstimate.homemadeCost.toFixed(2)}`,
      subheadline: `Save ~$${costEstimate.estimatedSavings.toFixed(2)} vs restaurant`,
      savedAmount: costEstimate.estimatedSavings,
      matchScore: scan.matchScore,
      footer: 'Made with Okyo',
    };

    const result = {
      status: 'success' as const,
      scan,
      recipe,
      groceryList,
      shareCard,
      note: usedOpenRouterAnalysis
        ? 'AI provider output is for testing only. No image was stored; verify all food, cost, and recipe details.'
        : 'AI provider generated this result.',
      ...createAiDebugMetadata(config, aiSource, scan.confidence, fallbackReason),
      scanState: analysis.scanState,
      uploadedImage,
    };

    // Fire-and-forget: analytics file I/O must not block the user's response.
    void logScanEvaluationFromResult(result, config).catch(() => undefined);
    logFinalScanResult(result);

    console.log('[scan_timing]', {
      dish: analysis.dishName,
      scanState: analysis.scanState,
      visionMs,
      recipeMs, // includes Epicure pre-call + recipe + structure/quality/component repairs
      totalMs: Date.now() - scanStartedAt,
    });

    if (scanCacheKey) {
      scanCache.set(scanCacheKey, { kind: 'success', result, expiresAt: Date.now() + SCAN_CACHE_TTL_MS });
      sweepScanCache();
    }
    return result;
  } catch (error) {
    // Fail-closed: throw on any provider error. Never return rejected scans.
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('api_scan_provider_failure', {
      model: config.openRouterVisionModel,
      errorMessage,
    });
    throw error;
  }
}


function createRecipeFromOpenRouterOutput(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
  mode: RecipeMode,
): GeneratedRecipeOutput {
  // One AI call -> one canonical recipe. The recipe is stamped with the mode the
  // scan was generated under (origin metadata); Budget/Healthy are computed view
  // projections in the UI, never separate generations.
  const recipe = createRecipeFromVariant(output, analysis, mode);

  return {
    aiSource: 'openrouter_ai',
    confidence: Math.min(analysis.confidence, 0.82),
    confidenceNote: `AI-assisted testing output. Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
    mode,
    recipe,
    recipeId: recipe.id,
    title: recipe.title,
  };
}

function createRecipeFromVariant(
  variant: OpenRouterRecipeVariant,
  analysis: FoodImageAnalysis,
  mode: RecipeMode,
  options: {
    confidenceNotePrefix?: string;
    idPrefix?: string;
  } = {},
): Recipe {
  const restaurantPrice = normalizeRestaurantPrice(analysis.restaurantPriceEstimate);
  // Single canonical recipe: homemade cost is the AI estimate, normalized. No
  // per-mode cost multipliers — Budget/Healthy are view projections, not data.
  const homemadeCost = normalizeHomemadeCost(analysis.homemadeCostEstimate, restaurantPrice);
  const title = getRecipeTitle(variant.title, analysis.dishName, mode);
  const ingredients = getRecipeIngredients(variant.ingredients, analysis, mode);
  const prepTimeMinutes = parseMinutes(variant.prepTime, 15);
  const cookTimeMinutes = parseMinutes(variant.cookTime, 25);
  const totalTimeMinutes = parseMinutes(variant.totalTime, prepTimeMinutes + cookTimeMinutes);
  const activeTimeMinutes = parseMinutes(variant.activeTime, Math.min(totalTimeMinutes, prepTimeMinutes + 10));
  const servings = parseServings(variant.servings, 2);
  const skillLevel = normalizeDifficulty(variant.skillLevel || variant.difficulty);
  const steps = getRecipeSteps(variant.steps, analysis.dishName);
  const structuredSteps = getStructuredSteps(variant.steps, steps, analysis, ingredients.map((i) => i.name));
  const isCompactRecipe = Array.isArray(variant.steps) && variant.steps.length > 0 && variant.steps.every((s) => typeof s === 'string');
  const ingredientGroups = getIngredientGroups(variant.ingredientGroups, ingredients, analysis);
  const spicePairings = getSpicePairings(variant.spicePairings, analysis);
  const cookingTerms = getCookingTerms(variant.cookingTerms, steps);
  const groceryItems = getGroceryItems(ingredients, analysis);
  const mistakeWarning = cleanRecipeCopy(getShortText(
    variant.mistakeWarning || variant.avoidMistake,
    getDefaultAvoidMistake(analysis),
    140,
  ));
  const storage = cleanRecipeCopy(getShortText(
    variant.storage || variant.storageAndReheating,
    getDefaultStorageAndReheating(analysis),
    160,
  ));

  return sanitizeRecipeVagueness({
    id: `${options.idPrefix ?? 'ai'}-${slugify(analysis.dishName)}-${slugify(mode)}`,
    scanResultId: analysis.candidateScanId,
    title,
    mode,
    description: ensureInspiredCopy(cleanRecipeCopy(getOneSentence(variant.description, `${title} with flexible, home-kitchen ingredients.`))),
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes,
    activeTimeMinutes,
    servings,
    skillLevel,
    difficulty: skillLevel,
    estimatedHomemadeCost: homemadeCost,
    estimatedSavings: Math.max(0, restaurantPrice - homemadeCost),
    ingredients,
    ingredientGroups,
    steps,
    structuredSteps,
    substitutions: getSafeList(variant.substitutions, getDefaultSubstitutions(), 3).map(cleanRecipeCopy),
    pantryNote: 'Assumes salt, pepper, and basic oil are on hand.',
    confidenceNote: `${options.confidenceNotePrefix ?? 'AI-assisted testing output.'} Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
    mainIngredientsSummary: getDefaultMainIngredientsSummary(ingredients),
    equipment: getSafeList(variant.equipment, getDefaultEquipment(analysis), 5).map(cleanRecipeCopy),
    bestFor: getDefaultBestFor(),
    avoidMistake: mistakeWarning,
    mistakeWarning,
    storageAndReheating: storage,
    storage,
    groceryItems,
    spicePairings,
    cookingTerms,
    isCompactRecipe: isCompactRecipe || undefined,
  }, analysis);
}


async function logScanEvaluationFromResult(result: AiScanSuccessResult, config: ReturnType<typeof getAiConfig>) {
  await logScanEvaluation({
    aiSource: result.aiSource,
    config,
    fallbackReason: result.fallbackReason,
    scan: result.scan,
    scanId: result.scan.id,
    scanState: result.scanState,
    status: 'success',
    uploadedImage: result.uploadedImage,
  });
}


// Returns a FoodRejectionError if the vision analysis indicates non-food or unclear food,
// null if generation should proceed. Only gates real uploaded images — demo/mock mode passes through.
function getFoodGateRejection(analysis: FoodImageAnalysis, uploadedImage: boolean): FoodRejectionError | null {
  if (!uploadedImage) return null;

  if (analysis.scanState === 'not_food') {
    return new FoodRejectionError({ rejectionType: 'no_food_detected', scanState: analysis.scanState, confidence: analysis.confidence, dishName: analysis.dishName });
  }
  if (analysis.scanState === 'too_unclear') {
    return new FoodRejectionError({ rejectionType: 'unclear_food', scanState: analysis.scanState, confidence: analysis.confidence, dishName: analysis.dishName });
  }
  // Extra guard: food scan state but completely generic dish name + low confidence
  // catches cases where the vision model hallucinated a food state for a non-food image.
  if (isGenericDishName(analysis.dishName) && analysis.confidence < uploadedImageConfidenceThreshold) {
    return new FoodRejectionError({ rejectionType: 'unclear_food', scanState: analysis.scanState, confidence: analysis.confidence, dishName: analysis.dishName });
  }

  return null;
}

function hasRealUploadedImage(input: AnalyzeFoodImageInput) {
  return Boolean(
    input.image &&
    !input.image.placeholder &&
    (
      input.image.uri ||
      input.image.dataUrl ||
      input.image.fileName ||
      input.image.width ||
      input.image.height ||
      input.image.sizeBytes ||
      input.image.dataUrlSizeBytes
    ),
  );
}

function isProviderVisibleImage(image: ScanImageMetadata | undefined) {
  return Boolean(
    image &&
    !image.placeholder &&
    (
      image.dataUrl?.startsWith('data:image/') ||
      image.uri?.startsWith('https://') ||
      image.uri?.startsWith('http://')
    ),
  );
}

function getImageUnavailableReason(image: ScanImageMetadata | undefined) {
  if (image?.conversionError === 'image_payload_too_large') {
    return 'This photo was too large to scan. Try a smaller image.';
  }
  if (image?.conversionError === 'image_base64_missing') {
    return 'Okyo could not analyze this photo because the image data was not available. Try another photo.';
  }
  if (image?.conversionError === 'image_processing_failed') {
    return 'Okyo could not prepare this photo for scanning. Try another food photo.';
  }

  return 'Okyo could not analyze this photo because the uploaded image was not available to the AI scanner.';
}

function getUnavailableAiReason(config: ReturnType<typeof getAiConfig>) {
  if (!config.enabled) {
    return 'ai_disabled';
  }
  if (!config.openRouterApiKey) {
    return 'openrouter_missing_key';
  }

  return 'ai_unavailable';
}

function getGroceryListForRecipe(recipe: Recipe): GroceryList | undefined {
  if (recipe.groceryItems && recipe.groceryItems.length > 0) {
    return {
      id: `grocery-${recipe.id}`,
      items: recipe.groceryItems,
      recipeId: recipe.id,
      title: `${recipe.title} Grocery List`,
    };
  }

  return undefined;
}

function getBlendedConfidence(...scores: number[]) {
  const validScores = scores.filter((score) => Number.isFinite(score));
  if (validScores.length === 0) {
    return 0.5;
  }

  const average = validScores.reduce((total, score) => total + score, 0) / validScores.length;
  return Math.max(0, Math.min(1, Number(average.toFixed(2))));
}

function getBestGuessNote(analysis: FoodImageAnalysis) {
  switch (analysis.scanState) {
    case 'food_present_uncertain_dish':
      return `Best guess: ${analysis.dishName}. You can edit or retry if this is off.`;
    case 'partial_food':
      return `Looks like ${analysis.dishName}. We made a homemade version based on what is visible.`;
    case 'clear_food':
      return `Looks like ${analysis.dishName}.`;
    case 'not_food':
      return 'No food recipe was generated for this photo.';
    case 'too_unclear':
      return 'The photo was too unclear for a useful recipe.';
  }
}

export function normalizeVisionOutput(output: OpenRouterVisionOutput) {
  const confidence = normalizeConfidence(output.confidence);
  // A restaurant price guessed from a food photo is not real data. Savings must come
  // from a user-entered price, so photo-derived price estimates are always dropped.
  const restaurantPriceEstimate = 0;
  const homemadeCostEstimate = normalizeHomemadeCost(output.homemadeCostEstimate, restaurantPriceEstimate);
  const explicitScanState = normalizeScanState(output.scanState);
  const foodDetected = normalizeBoolean(output.foodDetected, false);
  const isFoodImage = normalizeBoolean(
    output.isFoodImage,
    foodDetected || (explicitScanState ? isFoodScanState(explicitScanState) : true),
  );
  const isRestaurantMeal = normalizeBoolean(output.isRestaurantMeal, isFoodImage);
  const visibleComponents = normalizeVisibleComponents(output.visibleComponents);
  const visibleComponentIngredients = getVisibleComponentValues(visibleComponents);
  const explicitVisibleIngredients = getSafeList(output.visibleIngredients, [], 24);
  const visibleIngredients = explicitVisibleIngredients.length > 0 ? explicitVisibleIngredients : visibleComponentIngredients.slice(0, 24);
  const explicitLikelyIngredients = getSafeList(output.likelyIngredients, [], 12);
  const likelyIngredients = getSafeList(
    output.likelyIngredients,
    visibleIngredients.length > 0 ? visibleIngredients : [],
    12,
  );
  const rawDishName = getSafeTextValue(output.dishName, '');
  const broadDishCategory = normalizeBroadDishCategory(
    output.broadDishCategory ?? output.dishCategory,
    [
      ...explicitVisibleIngredients,
      ...explicitLikelyIngredients,
      rawDishName,
      getSafeTextValue(output.confidenceReason, ''),
      getSafeTextValue(output.rejectionReason, ''),
    ],
  );
  const cuisine = getSafeTextValue(output.cuisine, 'Restaurant-style');
  const scanState = reconcileScanState({
    broadDishCategory,
    confidence,
    explicitScanState,
    foodEvidenceText: [
      rawDishName,
      broadDishCategory,
      cuisine,
      output.confidenceReason,
      output.rejectionReason,
      ...explicitVisibleIngredients,
      ...explicitLikelyIngredients,
      ...getVisibleComponentValues(visibleComponents),
    ].join(' '),
    foodDetected,
    rawDishName,
    isFoodImage,
    visibleComponents,
    visibleIngredients,
  });
  const normalizedIsFoodImage = scanState === 'not_food' || scanState === 'too_unclear'
    ? false
    : isFoodImage || isFoodScanState(scanState);
  const dishName = maybeRenameMusubi(
    normalizeDishName(output.dishName, cuisine, broadDishCategory, [
      ...getVisibleComponentValues(visibleComponents),
      ...visibleIngredients,
      ...likelyIngredients,
    ]),
    [...visibleIngredients, ...likelyIngredients].join(' '),
  );
  const possibleDishNames = normalizePossibleDishNames(output.possibleDishNames, dishName, broadDishCategory);

  return {
    broadDishCategory,
    confidence,
    confidenceReason: getShortText(
      output.confidenceReason,
      getDefaultConfidenceReason(scanState),
      160,
    ),
    cuisine,
    dishName,
    epicureSuggestions: output.epicureSuggestions,
    homemadeCostEstimate,
    isFoodImage: normalizedIsFoodImage,
    isRestaurantMeal: normalizedIsFoodImage ? isRestaurantMeal : false,
    likelyIngredients,
    possibleDishNames,
    rejectionReason: getOptionalShortText(output.rejectionReason, 160),
    restaurantPriceEstimate,
    scanState,
    visibleComponents,
    visibleIngredients,
  };
}

function isFoodScanState(scanState: ScanState) {
  return scanState === 'clear_food' ||
    scanState === 'food_present_uncertain_dish' ||
    scanState === 'partial_food';
}

function reconcileScanState(input: {
  broadDishCategory: string;
  confidence: number;
  explicitScanState?: ScanState;
  foodEvidenceText: string;
  foodDetected: boolean;
  rawDishName: string;
  isFoodImage: boolean;
  visibleComponents: FoodImageAnalysis['visibleComponents'];
  visibleIngredients: string[];
}): ScanState {
  const hasFoodEvidence = input.foodDetected ||
    input.isFoodImage ||
    hasVisibleFoodClues(input.visibleComponents, input.visibleIngredients) ||
    hasUsefulDishCategory(input.broadDishCategory) ||
    hasUsefulDishName(input.rawDishName) ||
    hasFoodLikeEvidence(input.foodEvidenceText);

  if (!input.explicitScanState) {
    return inferScanState({
      confidence: input.confidence,
      isFoodImage: hasFoodEvidence,
    });
  }

  if (isFoodScanState(input.explicitScanState)) {
    if (input.confidence < uploadedImageConfidenceThreshold) {
      return 'too_unclear';
    }

    return input.confidence >= 0.8
      ? 'clear_food'
      : input.confidence >= 0.6
        ? input.explicitScanState === 'clear_food' ? 'food_present_uncertain_dish' : input.explicitScanState
        : 'partial_food';
  }

  if (
    (input.explicitScanState === 'not_food' || input.explicitScanState === 'too_unclear') &&
    hasFoodEvidence
  ) {
    return input.confidence >= 0.6 ? 'food_present_uncertain_dish' : 'partial_food';
  }

  return input.explicitScanState;
}

function hasVisibleFoodClues(
  visibleComponents: FoodImageAnalysis['visibleComponents'],
  visibleIngredients: string[],
) {
  return getVisibleComponentValues(visibleComponents).length > 0 || visibleIngredients.length > 0;
}

function hasUsefulDishCategory(value: string) {
  return value.trim().length > 0 && value !== 'unknown food dish';
}

function hasUsefulDishName(value: string) {
  return value.trim().length > 0 && !isVagueDishName(value);
}

function hasFoodLikeEvidence(value: string) {
  return includesAny(value.toLowerCase(), foodEvidenceKeywords);
}

function normalizeConfidence(value: unknown) {
  const parsed = getFiniteNumber(value);
  if (parsed === undefined) {
    return 0.5;
  }

  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return clampNumber(percent, 0, 100) / 100;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeScanState(value: unknown): ScanState | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return scanStateSchema.safeParse(normalized).success ? normalized as ScanState : undefined;
}

function inferScanState(input: {
  confidence: number;
  isFoodImage: boolean;
}): ScanState {
  if (!input.isFoodImage && input.confidence >= notFoodConfidenceThreshold) {
    return 'not_food';
  }

  if (!input.isFoodImage || input.confidence < uploadedImageConfidenceThreshold) {
    return 'too_unclear';
  }

  if (input.confidence >= 0.8) {
    return 'clear_food';
  }

  if (input.confidence >= 0.6) {
    return 'food_present_uncertain_dish';
  }

  return 'partial_food';
}

function normalizeVisibleComponents(value: unknown): FoodImageAnalysis['visibleComponents'] {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return visibleComponentsSchema.parse({
    protein: getOptionalShortText(record.protein, 80) ?? '',
    sauce: getOptionalShortText(record.sauce, 80) ?? '',
    baseStarch: getOptionalShortText(record.baseStarch ?? record.base ?? record.starch, 80) ?? '',
    vegetables: getOptionalShortText(record.vegetables ?? record.vegetable, 80) ?? '',
    toppingsGarnish: getOptionalShortText(
      record.toppingsGarnish ?? record.toppings ?? record.garnish,
      80,
    ) ?? '',
    cookingMethod: getOptionalShortText(record.cookingMethod ?? record.method, 80) ?? '',
  });
}

function getVisibleComponentValues(components: FoodImageAnalysis['visibleComponents']) {
  return [
    components.protein,
    components.sauce,
    components.baseStarch,
    components.vegetables,
    components.toppingsGarnish,
  ].filter((value) => value.trim().length > 0);
}

function normalizeBroadDishCategory(value: unknown, ingredients: string[]) {
  const raw = getSafeTextValue(value, '').toLowerCase().replace(/_/g, ' ').trim();
  const allowedCategories = [
    'pizza',
    'pasta/noodles',
    'rice bowl',
    'burger/sandwich',
    'tacos/wrap',
    'grilled meat',
    'fried food',
    'seafood',
    'salad',
    'soup/stew',
    'dessert',
    'breakfast item',
    'drink/beverage',
    'mixed platter',
    'unknown food dish',
  ];
  const explicitCategory = allowedCategories.find((category) => raw === category || raw.includes(category));
  if (explicitCategory && explicitCategory !== 'unknown food dish') {
    return explicitCategory;
  }
  if (includesAny(raw, ['drink', 'beverage', 'smoothie', 'latte', 'juice'])) {
    return 'drink/beverage';
  }

  const text = ingredients.join(' ').toLowerCase();
  if (includesAny(text, ['smoothie', 'milkshake', 'latte', 'matcha', 'iced coffee', 'cold brew', 'frappe', 'boba', 'bubble tea', 'lemonade'])) {
    return 'drink/beverage';
  }
  if (includesAny(text, ['pizza', 'slice'])) {
    return 'pizza';
  }
  if (includesAny(text, ['pasta', 'rigatoni', 'spaghetti', 'penne', 'noodle', 'ramen', 'udon'])) {
    return 'pasta/noodles';
  }
  if (includesAny(text, ['rice', 'grain', 'bowl'])) {
    return 'rice bowl';
  }
  if (includesAny(text, ['burger', 'sandwich', 'bun', 'patty'])) {
    return 'burger/sandwich';
  }
  if (includesAny(text, ['taco', 'tortilla', 'wrap', 'burrito'])) {
    return 'tacos/wrap';
  }
  if (includesAny(text, ['steak', 'grilled', 'skewer', 'kebab', 'bbq', 'charred', 'roasted', 'lamb', 'pork', 'beef', 'meat'])) {
    return 'grilled meat';
  }
  if (includesAny(text, ['fried', 'crispy', 'tempura', 'cutlet', 'fries'])) {
    return 'fried food';
  }
  if (includesAny(text, ['fish', 'shrimp', 'salmon', 'sushi', 'seafood'])) {
    return 'seafood';
  }
  if (includesAny(text, ['salad', 'greens', 'lettuce'])) {
    return 'salad';
  }
  if (includesAny(text, ['soup', 'stew', 'broth', 'ramen'])) {
    return 'soup/stew';
  }
  if (includesAny(text, ['cake', 'cookie', 'dessert', 'ice cream', 'brownie'])) {
    return 'dessert';
  }
  if (includesAny(text, ['egg', 'toast', 'pancake', 'waffle', 'breakfast'])) {
    return 'breakfast item';
  }

  if (includesAny(text, ['sauce', 'plate', 'platter', 'garnish', 'vegetable', 'vegetables', 'stir fry', 'stir-fry'])) {
    return 'mixed platter';
  }

  return 'unknown food dish';
}

function getDefaultConfidenceReason(scanState: ScanState) {
  switch (scanState) {
    case 'clear_food':
      return 'The photo clearly shows food and enough visual detail for a confident best guess.';
    case 'food_present_uncertain_dish':
      return 'Food is visible, but the exact dish or cuisine is uncertain, so this is a best guess.';
    case 'partial_food':
      return 'Food is partly visible or the photo is low quality, so this is a cautious starter direction.';
    case 'not_food':
      return 'The image does not appear to show food.';
    case 'too_unclear':
      return 'The image is too unclear to identify visible food safely.';
  }
}

function normalizeRestaurantPrice(value: unknown) {
  const parsed = getFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) {
    return 0;
  }

  return roundMoney(clampNumber(parsed, 0, 120));
}

function normalizeHomemadeCost(value: unknown, restaurantPrice: number) {
  const parsed = getFiniteNumber(value);
  if (restaurantPrice <= 0) {
    const rawCost = parsed === undefined || parsed < 1 ? defaultHomemadeCost : parsed;
    return roundMoney(clampNumber(rawCost, 1, 80));
  }

  const defaultCost = Math.min(defaultHomemadeCost, Math.max(2, restaurantPrice * 0.45));
  const rawCost = parsed === undefined || parsed < 1 ? defaultCost : parsed;
  const cappedCost = rawCost >= restaurantPrice ? Math.max(1, restaurantPrice * 0.45) : rawCost;

  return roundMoney(clampNumber(cappedCost, 1, Math.max(1, restaurantPrice - 0.5)));
}

function normalizeDishName(value: unknown, cuisine: string, broadDishCategory: string, ingredients: string[]) {
  const text = getSafeTextValue(value, '');
  if (text && !isVagueDishName(text)) {
    return cleanDishName(titleCase(text));
  }

  const ingredientText = ingredients.join(' ').toLowerCase();
  if (includesAny(ingredientText, ['smoothie', 'milkshake', 'blended drink'])) {
    return buildDrinkName(ingredientText);
  }
  if (ingredientText.includes('matcha')) {
    return 'Iced Matcha Latte';
  }
  if (includesAny(ingredientText, ['latte', 'espresso', 'cold brew', 'iced coffee', 'cappuccino'])) {
    return 'Iced Coffee Latte';
  }
  if (includesAny(ingredientText, ['juice', 'lemonade'])) {
    return 'Fresh Fruit Juice';
  }
  if (includesAny(ingredientText, ['boba', 'bubble tea'])) {
    return 'Bubble Tea';
  }
  if (ingredientText.includes('tomato') && includesAny(ingredientText, ['pasta', 'rigatoni', 'spaghetti', 'penne'])) {
    return 'Creamy Tomato Pasta';
  }
  if (includesAny(ingredientText, ['pasta', 'rigatoni', 'spaghetti', 'penne', 'noodle', 'ramen', 'udon'])) {
    return includesAny(ingredientText, ['noodle', 'ramen', 'udon']) ? 'Noodle Bowl' : 'Pasta Bowl';
  }
  if (includesAny(ingredientText, ['rice', 'grain', 'bowl'])) {
    return ingredientText.includes('chicken') ? 'Grilled Chicken Rice Bowl' : 'Saucy Rice Bowl';
  }
  if (ingredientText.includes('burger') || ingredientText.includes('patty')) {
    return 'Loaded Burger';
  }
  if (includesAny(ingredientText, ['charred', 'grilled', 'steak', 'lamb', 'pork', 'beef', 'meat', 'skewer', 'kebab'])) {
    return 'Grilled Meat Plate';
  }
  if (includesAny(ingredientText, ['stir fry', 'stir-fry'])) {
    return 'Stir-Fry Plate';
  }
  if (ingredientText.includes('chicken')) {
    return ingredientText.includes('fried') || ingredientText.includes('crispy')
      ? 'Saucy Fried Chicken'
      : 'Grilled Chicken Plate';
  }

  switch (broadDishCategory) {
    case 'pizza':
      return 'Pizza';
    case 'pasta/noodles':
      return 'Noodle Bowl';
    case 'rice bowl':
      return 'Saucy Rice Bowl';
    case 'burger/sandwich':
      return 'Loaded Sandwich';
    case 'tacos/wrap':
      return 'Loaded Tacos';
    case 'grilled meat':
      return 'Grilled Meat Plate';
    case 'fried food':
      return 'Saucy Fried Plate';
    case 'seafood':
      return 'Seafood Plate';
    case 'salad':
      return 'Loaded Salad';
    case 'soup/stew':
      return 'Cozy Soup Bowl';
    case 'dessert':
      return 'Restaurant-Style Dessert';
    case 'breakfast item':
      return 'Breakfast Plate';
    case 'drink/beverage':
      return buildDrinkName(ingredientText);
    case 'mixed platter':
      return 'Mixed Restaurant Plate';
    default:
      return cuisine && cuisine !== 'Restaurant-style' ? `${titleCase(cuisine)}-Style Plate` : 'Restaurant-Style Food Plate';
  }
}

function normalizePossibleDishNames(value: unknown, dishName: string, broadDishCategory: string) {
  const suggestions = getSafeList(Array.isArray(value) ? value : undefined, [], 6)
    .map((name) => cleanDishName(titleCase(name)))
    .filter((name) => name && !isVagueDishName(name));
  const fallbackSuggestions = getBroadDishAlternatives(dishName, broadDishCategory);
  const seen = new Set<string>();

  return [dishName, ...suggestions, ...fallbackSuggestions]
    .filter((name, index) => {
      const key = name.toLowerCase();
      // Keep the primary dishName; drop generic alternates.
      if (!name || seen.has(key) || (index > 0 && isVagueDishName(name))) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function getBroadDishAlternatives(dishName: string, broadDishCategory: string) {
  switch (broadDishCategory) {
    case 'grilled meat':
      return ['Grilled Meat Plate', 'Charred Grill Plate', 'Grilled Chicken Plate'];
    case 'rice bowl':
      return ['Saucy Rice Bowl', 'Grilled Chicken Rice Bowl', 'Stir-Fry Plate'];
    case 'pasta/noodles':
      return ['Noodle Bowl', 'Pasta Bowl', 'Saucy Noodles'];
    case 'burger/sandwich':
      return ['Loaded Sandwich', 'Loaded Burger', 'Cheeseburger'];
    case 'pizza':
      return ['Pizza', 'Cheesy Pizza', 'Margherita-Style Pizza'];
    case 'salad':
      return ['Loaded Salad', 'Chopped Salad', 'Mediterranean-Style Salad'];
    case 'drink/beverage':
      return ['Fruit Smoothie', 'Berry Smoothie', 'Iced Latte'];
    case 'dessert':
      return ['Chocolate Cake', 'Ice Cream Sundae', 'Restaurant-Style Dessert'];
    case 'mixed platter':
      return ['Grilled Meat Plate', 'Saucy Rice Bowl', 'Loaded Salad'];
    default:
      return ['Saucy Rice Bowl', 'Loaded Sandwich', 'Noodle Bowl'];
  }
}

function isVagueDishName(value: string) {
  return isGenericDishName(value);
}

// Builds an honest, specific drink name from visible clues when the model
// could not name the drink itself.
function buildDrinkName(ingredientText: string) {
  if (ingredientText.includes('matcha')) {
    return 'Iced Matcha Latte';
  }
  if (includesAny(ingredientText, ['coffee', 'espresso', 'latte', 'cold brew', 'cappuccino'])) {
    return 'Iced Coffee Latte';
  }
  if (includesAny(ingredientText, ['boba', 'bubble tea'])) {
    return 'Bubble Tea';
  }
  if (includesAny(ingredientText, ['chocolate', 'cocoa'])) {
    return 'Chocolate Milkshake';
  }
  if (includesAny(ingredientText, ['berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'acai', 'purple'])) {
    return 'Berry Smoothie';
  }
  if (includesAny(ingredientText, ['mango', 'pineapple', 'tropical'])) {
    return 'Tropical Fruit Smoothie';
  }
  if (includesAny(ingredientText, ['spinach', 'kale', 'green'])) {
    return 'Green Smoothie';
  }
  if (ingredientText.includes('banana')) {
    return 'Banana Smoothie';
  }
  if (includesAny(ingredientText, ['juice', 'lemonade'])) {
    return 'Fresh Fruit Juice';
  }

  return 'Fruit Smoothie';
}

function cleanDishName(value: string) {
  return value
    .replace(/\bpossible\s+/gi, '')
    .replace(/\bmaybe\s+/gi, '')
    .replace(/\bunknown\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRecipeTitle(value: string, dishName: string, mode: RecipeMode) {
  const prefix = mode === 'Budget' ? 'Budget ' : mode === 'Healthy' ? 'Lighter ' : '';
  const fallbackTitle = `${prefix}${dishName}`;
  // Strip "Homemade" before isGenericDishName check so "Homemade Restaurant-Style Food Plate"
  // falls through to the fallback instead of surfacing as a title.
  const stripped = typeof value === 'string' ? value.replace(/^homemade\s+/i, '').trim() : '';
  const safeValue = stripped && !isPlaceholderText(stripped) && !isGenericDishName(stripped) ? stripped : '';

  return ensureInspiredTitle(getShortText(safeValue, fallbackTitle, 90));
}

// Standalone words that are too vague to ever ship as an ingredient name or to
// stand in for an actual ingredient in a step. Exact-match only, so real names
// like "tomato sauce" or "mixed vegetables, chopped" are never caught.
const vagueIngredientWords = new Set([
  'main ingredient', 'the main ingredient', 'main ingredients', 'the main ingredients',
  'visible main ingredient', 'protein', 'proteins', 'the protein', 'vegetable', 'vegetables',
  'veggies', 'sauce', 'sauces', 'sauce base', 'seasoning', 'seasonings', 'spice', 'spices',
  'topping', 'toppings', 'optional items', 'optional toppings', 'ingredients', 'filling',
  'fillings', 'cream stuff', 'food', 'dish', 'meal', 'stuff',
  // Dish names that slip through as ingredient strings — blocked here so they never
  // reach the ingredient list. "elote" is translated (not blocked) via DISH_NAME_TRANSLATIONS.
  'burger', 'burgers', 'pizza', 'taco', 'tacos', 'sushi', 'gyoza', 'dumpling', 'dumplings',
  'wonton', 'wontons', 'potsticker', 'potstickers', 'pot sticker', 'pot stickers', 'mandu',
  'ramen bowl', 'pho bowl',
]);

function isVagueIngredientWord(value: string) {
  return vagueIngredientWords.has(value.trim().toLowerCase());
}

// Ingredient synonym matching lives in recipeIngredientValidation.ts —
// imported as ingredientsMatch, shared with the closure validator.

// Verb-to-tool mapping for high-confidence tool detection from step text.
const TOOL_DETECTION_RULES: Array<{ verbs: RegExp; tools: string[] }> = [
  { verbs: /\b(chop|dice|mince|slice|cut|halve|quarter|julienne|trim|peel)\b/, tools: ["chef's knife", 'cutting board'] },
  { verbs: /\b(whisk|beat|stir vigorously|mix vigorously)\b/, tools: ['whisk', 'mixing bowl'] },
  { verbs: /\b(bake|roast)\b/, tools: ['oven', 'baking sheet'] },
  { verbs: /\b(drain|strain)\b/, tools: ['colander'] },
  { verbs: /\b(grate|zest)\b/, tools: ['grater'] },
  { verbs: /\b(blend|purée|puree)\b/, tools: ['blender'] },
  { verbs: /\b(simmer|sauté|saute|fry|sear|brown)\b/, tools: ['skillet', 'spatula'] },
  { verbs: /\b(boil)\b/, tools: ['pot', 'slotted spoon'] },
  { verbs: /\b(measure)\b/, tools: ['measuring cup', 'measuring spoons'] },
];

// Detects tools required by a step based on cooking verb patterns.
// Used as a fallback when the AI omits toolsUsed, and in audit warnings.
function detectToolsFromStep(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];
  for (const rule of TOOL_DETECTION_RULES) {
    if (rule.verbs.test(lower)) {
      detected.push(...rule.tools);
    }
  }
  return [...new Set(detected)];
}

// Cooking verbs used to classify steps as "cooking" for audit and weakness detection.
// sauté/saute covers ~35–40% of real recipes that would otherwise be invisible to the repair loop.
const PHASE_COOKING_VERBS_RE = /\b(sear|fry|roast|bake|boil|grill|simmer|saut[eé]|steam|poach|braise|brown|reduce|stir.?fry|caramelize|toast|deep.?fry|pan.?fry|air.?fry)\b/;

// Visual and sensory vocabulary that indicates a lookFor/doneWhen is observable.
const VISUAL_SIGNAL_VOCAB = /\b(golden|brown|browned|caramelized|caramelize|translucent|opaque|bubbling|sizzling|crispy|glossy|thicken|thickened|reduced|wilted|softened|darkened|pale|foamy|puffed|charred|seared|crusty|set|firmed?|separated|curled?|crisp|toasted?|melted?|coated?|golden.?brown|lightly.?brown|no.?pink|runs?.?clear|white.?throughout|pulls?.?away|falls?.?off)\b/;
const SENSORY_SIGNAL_VOCAB = /\b(smell|aroma|sizzle|sizzling|fragrant|nutty|tender|jiggles?|springy|spring.?back|al.?dente|crunchy|sticky|resistance|caramel)\b/;
// Temperature readings and physical doneness tests are equally valid completion
// signals. The repair prompt (repairStepCoachingWithAI) already tells the model
// these qualify — the detectors below MUST agree or a perfectly good
// "Reads 165°F on a thermometer" gets wrongly flagged weak and triggers repair.
// The `\d{2,3}\s*°` form requires the degree mark, so "12 cups" can't match.
const TEMPERATURE_SIGNAL_VOCAB = /\b\d{2,3}\s*°|°\s*[fc]\b|\bdegrees?\b|\bthermometer\b|\binternal temp(?:erature)?\b/i;
const PHYSICAL_TEST_VOCAB = /\bcoats?\b[^.]{0,25}\bspoon\b|\bfork[\s-]?tender\b|\bflakes?\b|\bknife\b[^.]{0,25}\b(?:slides?|inserts?|comes? out|clean)\b|\bpulls? apart\b/i;

// A cue counts as observable when the cook can SEE, HEAR, SMELL, FEEL, or MEASURE
// it — color, texture, sound, aroma, a physical test, or a temperature. A bare
// timer ("cook 5 minutes") is deliberately excluded: it says WHEN to look, not
// WHAT doneness looks like. Single source of truth for every lookFor/doneWhen check.
function hasObservableSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return VISUAL_SIGNAL_VOCAB.test(lower)
    || SENSORY_SIGNAL_VOCAB.test(lower)
    || TEMPERATURE_SIGNAL_VOCAB.test(lower)
    || PHYSICAL_TEST_VOCAB.test(lower);
}

// A specific, honest best-guess noun for the dish's main component, derived from
// the vision analysis. Never returns a vague placeholder — this is what replaces
// any "main ingredient" wording so the hard ban can always be satisfied.
function getBestGuessIngredientName(analysis: FoodImageAnalysis): string {
  const candidates = [
    analysis.visibleComponents?.protein,
    analysis.visibleComponents?.baseStarch,
    analysis.visibleComponents?.vegetables,
    ...(Array.isArray(analysis.visibleIngredients) ? analysis.visibleIngredients : []),
    ...(Array.isArray(analysis.likelyIngredients) ? analysis.likelyIngredients : []),
  ];
  for (const candidate of candidates) {
    const cleaned = (candidate ?? '').trim().toLowerCase();
    if (cleaned.length > 2 && !isVagueIngredientWord(cleaned)) {
      return cleaned;
    }
  }

  return getCategoryMainIngredient(analysis.broadDishCategory, analysis.dishName);
}

function getCategoryMainIngredient(broadDishCategory: string, dishName: string): string {
  const text = `${broadDishCategory} ${dishName}`.toLowerCase();
  if (text.includes('pizza')) return 'the dough, sauce, and cheese';
  if (includesAny(text, ['cheeseburger', 'burger'])) return 'the burger patty';
  if (includesAny(text, ['noodle', 'ramen', 'udon', 'pho'])) return 'the noodles';
  if (includesAny(text, ['pasta', 'rigatoni', 'spaghetti', 'penne', 'lasagna'])) return 'the pasta';
  if (includesAny(text, ['fried rice', 'rice bowl', 'rice', 'grain', 'bowl'])) return 'the cooked rice';
  if (includesAny(text, ['salad', 'greens'])) return 'the greens';
  if (includesAny(text, ['smoothie', 'shake', 'juice', 'frappe'])) return 'the fruit';
  if (includesAny(text, ['latte', 'matcha', 'coffee', 'cappuccino'])) return 'the brewed coffee or matcha';
  if (includesAny(text, ['taco', 'burrito', 'wrap', 'quesadilla'])) return 'the filling and tortillas';
  if (includesAny(text, ['chicken'])) return 'the chicken';
  if (includesAny(text, ['steak', 'beef'])) return 'the beef';
  if (includesAny(text, ['pork', 'bacon', 'ham'])) return 'the pork';
  if (includesAny(text, ['salmon', 'shrimp', 'fish', 'seafood', 'tuna'])) return 'the seafood';
  if (includesAny(text, ['tofu'])) return 'the tofu';
  if (includesAny(text, ['soup', 'stew', 'chili'])) return 'the broth and vegetables';
  if (includesAny(text, ['cake', 'cookie', 'brownie', 'dessert', 'pastry'])) return 'the batter';
  if (includesAny(text, ['egg', 'omelet', 'breakfast'])) return 'the eggs';

  const cleanedDish = dishName.trim().toLowerCase();
  return cleanedDish && !isVagueDishName(cleanedDish) ? `the ${cleanedDish}` : 'the prepped ingredients';
}

// Hard guarantee: "the main ingredient" (and its variants) can never reach the
// app. Replaces the banned phrasing with a specific best-guess noun.
function sanitizeVagueRecipeText(text: string, bestGuess: string): string {
  if (!text) {
    return text;
  }

  return text
    .replace(/\bthe\s+visible\s+main\s+ingredients?\b/gi, bestGuess)
    .replace(/\bvisible\s+main\s+ingredients?\b/gi, bestGuess)
    .replace(/\bthe\s+main\s+ingredients?\b/gi, bestGuess)
    .replace(/\bmain\s+ingredients?\b/gi, bestGuess)
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRecipeVagueness(recipe: Recipe, analysis: FoodImageAnalysis): Recipe {
  const guess = getBestGuessIngredientName(analysis);
  const fix = (value: string) => sanitizeVagueRecipeText(value, guess);
  const fixOptional = (value: string | undefined) => (value ? fix(value) : value);

  return {
    ...recipe,
    description: fix(recipe.description),
    steps: recipe.steps.map(fix),
    structuredSteps: recipe.structuredSteps?.map((step) => ({
      ...step,
      text: fix(step.text),
      visualCue: step.visualCue ? fix(step.visualCue) : step.visualCue,
      whyItMatters: step.whyItMatters ? fix(step.whyItMatters) : step.whyItMatters,
      flavorBoost: step.flavorBoost ? fix(step.flavorBoost) : step.flavorBoost,
    })),
    ingredients: recipe.ingredients.map((item) => ({ ...item, name: fix(item.name) })),
    ingredientGroups: recipe.ingredientGroups?.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item, name: fix(item.name) })),
    })),
    groceryItems: recipe.groceryItems?.map((item) => ({ ...item, name: fix(item.name) })),
    substitutions: recipe.substitutions.map(fix),
    pantryNote: fix(recipe.pantryNote),
    mainIngredientsSummary: fixOptional(recipe.mainIngredientsSummary),
    avoidMistake: fixOptional(recipe.avoidMistake),
    mistakeWarning: fixOptional(recipe.mistakeWarning),
    storageAndReheating: fixOptional(recipe.storageAndReheating),
    storage: fixOptional(recipe.storage),
    bestFor: fixOptional(recipe.bestFor),
  };
}

function getRecipeIngredients(values: string[], analysis: FoodImageAnalysis, mode: RecipeMode) {
  const usableLikely = analysis.likelyIngredients.filter((item) => item && !isVagueIngredientWord(item));
  const ingredients = getSafeList(values, usableLikely, 16)
    .filter((value) => !isVagueIngredientWord(value))
    .map(toRecipeIngredient)
    .filter((ing) => !isVagueIngredientWord(ing.name))  // catch "1 burger" → name:"burger" post-parse
    .map((ing) => normalizeCheetosDust(ing, analysis))
    .map((ing) => normalizeSuspiciousSauce(ing, analysis))
    .map((ing) => normalizeRareProtein(ing));
  const beforeNames = ingredients.map((ing) => ing.name);
  const base = ensureCoreIngredients(ingredients, analysis, mode).slice(0, 16);
  const modeNormalized = mode === 'Budget' ? base.map(normalizeBudgetIngredient) : base;
  const dedupedList = dedupeIngredientConcepts(modeNormalized, analysis);
  const quantityFixed = dedupedList.map(normalizeBadQuantities);
  const simpleNormalized = normalizeSimpleFruitIngredients(quantityFixed, analysis);
  // Mango sticky rice: 5-8 ingredients max — coconut + mango + sticky rice + sugar + salt fits well inside.
  const finalList = isMangoStickyRiceDish(analysis.dishName ?? '')
    ? simpleNormalized.slice(0, 8)
    : simpleNormalized;
  console.log('[ingredient_quality]', {
    dish: analysis.dishName,
    mode,
    beforeCount: beforeNames.length,
    afterCount: finalList.length,
    added: finalList.map((ing) => ing.name).filter((name) => !beforeNames.includes(name)),
  });
  return finalList;
}

// Replace "hot cheetos dust" with "chili powder or Tajín" unless the dish context
// explicitly features Hot Cheetos/Takis/Flamin' Hot as a visible ingredient.
function normalizeCheetosDust(ingredient: RecipeIngredient, analysis: FoodImageAnalysis): RecipeIngredient {
  if (!/hot.?cheeto|cheeto.*dust|flamin.*hot.*dust|takis.*dust/i.test(ingredient.name)) {
    return ingredient;
  }
  const context = [analysis.dishName, ...analysis.visibleIngredients, ...analysis.likelyIngredients].join(' ');
  if (/cheeto|takis|flamin.?hot|hot.?chip/i.test(context)) {
    return ingredient; // intentional — keep it
  }
  return { ...ingredient, name: 'chili powder or tajín', quantity: ingredient.quantity || '1 tsp', pantryItem: true };
}

// Replace sauces that make no sense for the dish (e.g. "berry sauce" on octopus).
// Only fires when the sauce keyword is clearly off-context — never for desserts.
const SUSPICIOUS_SAUCE_RE = /\b(berry|berries|fruit|strawberry|blueberry|raspberry|mango|peach)\s+sauce\b/i;
const DESSERT_DISH_RE = /\b(cake|dessert|cheesecake|waffle|pancake|crepe|ice cream|brownie|pudding|tart)\b/i;

function normalizeSuspiciousSauce(ingredient: RecipeIngredient, analysis: FoodImageAnalysis): RecipeIngredient {
  if (!SUSPICIOUS_SAUCE_RE.test(ingredient.name)) return ingredient;
  const ctx = [analysis.dishName, analysis.broadDishCategory, ...analysis.visibleIngredients].join(' ');
  if (DESSERT_DISH_RE.test(ctx)) return ingredient;
  const lower = ctx.toLowerCase();
  let replacement = 'lemon garlic sauce';
  if (includesAny(lower, ['wonton', 'dumpling', 'gyoza', 'potsticker'])) replacement = 'soy dipping sauce';
  else if (includesAny(lower, ['burger', 'sandwich'])) replacement = 'burger sauce or mayo';
  else if (includesAny(lower, ['taco', 'mexican', 'burrito'])) replacement = 'salsa';
  else if (includesAny(lower, ['pasta', 'noodle', 'ramen'])) replacement = 'sauce base';
  return { ...ingredient, name: replacement };
}

// Swap rare/expensive proteins that are unlikely in a home kitchen.
// Fires in all modes — shark is a hallucination on novelty foods, not a real ingredient.
function normalizeRareProtein(ingredient: RecipeIngredient): RecipeIngredient {
  const name = ingredient.name;
  if (/\bshark\b/i.test(name)) {
    const replacement = /\bfillet/i.test(name) ? 'white fish fillets' : 'white fish';
    return { ...ingredient, name: name.replace(/\bshark(?:\s+fillets?)?\b/gi, replacement) };
  }
  return ingredient;
}

// Strip presentation-only modifiers that don't correspond to a grocery-store product.
// Only applies to Budget mode — Restaurant Copy/Healthy may intentionally specify
// particular cuts or presentations.
function normalizeBudgetIngredient(ingredient: RecipeIngredient): RecipeIngredient {
  const name = ingredient.name
    .replace(/\biceberg lettuce\s+leaves\b/gi, 'lettuce')
    .replace(/\b(?:crinkle-?cut|hand-?cut|house-?made|hand-?crafted|artisanal?|freshly-?cut|freshly-?ground)\b\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Budget-only: swap expensive proteins for affordable alternatives.
  if (/\blobster\b/i.test(name)) return { ...ingredient, name: name.replace(/\blobster\b/gi, 'shrimp') };
  if (/\b(?:swordfish|monkfish)\b/i.test(name)) return { ...ingredient, name: name.replace(/\b(?:swordfish|monkfish)\b/gi, 'white fish') };
  return name === ingredient.name ? ingredient : { ...ingredient, name };
}

// Plain fruit / minimally-prepped whole foods — dish needs 1-4 ingredients, not a salad.
// Excludes dishes that explicitly name complex additions (feta, yogurt, salad, etc.).
const PLAIN_FRUIT_RE = /\b(watermelon|cantaloupe|honeydew|melon|berries|blueberr(?:ies|y)|strawberr(?:ies|y)|raspberr(?:ies|y)|blackberr(?:ies|y)|grapes?|banana|pineapple|mango\s+(?:slice|cube|chunk)s?|orange\s+slices?|apple\s+slices?|kiwi\s+slices?|fruit\s+(?:cup|bowl|plate|platter|tray))\b/i;
const COMPLEX_FRUIT_RE = /\b(salad|feta|prosciutto|yogurt|granola|chocolate|sorbet|smoothie|tart|pie|cake|parfait|crumble|pudding|dressing|sauce)\b/i;

function isPlainFruitDish(dishName: string): boolean {
  const n = dishName.toLowerCase();
  return PLAIN_FRUIT_RE.test(n) && !COMPLEX_FRUIT_RE.test(n);
}

// Ingredients the model adds to "elevate" plain fruit into a composed dish — strip when not visible.
const FRUIT_CHEF_ADDITION_RE = /\b(feta|goat\s+cheese|cream\s+cheese|brie|camembert|fresh\s+mint|mint\s+leaves?|basil\s+leaves?|honey\b|agave|maple\s+syrup|granola|greek\s+yogurt|yogurt|almonds?|pistachios?|walnuts?|pecans?|cashews?|chia\s+seeds?|coconut\s+flakes?|chocolate\b|dark\s+chocolate|balsamic|balsamic\s+glaze|whipped\s+cream)\b/i;

function normalizeSimpleFruitIngredients(
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
): RecipeIngredient[] {
  if (!isPlainFruitDish(analysis.dishName ?? '')) return ingredients;
  // Only treat explicitly visible items as authorized additions.
  const visibleText = [analysis.dishName, ...analysis.visibleIngredients].join(' ').toLowerCase();
  return ingredients.filter((ing) => {
    const m = FRUIT_CHEF_ADDITION_RE.exec(ing.name.toLowerCase());
    if (!m) return true; // not a chef addition, keep it
    return visibleText.includes(m[0]); // only keep if actually visible
  });
}

// Cap absurd quantities the model consistently over-estimates.
function normalizeBadQuantities(ingredient: RecipeIngredient): RecipeIngredient {
  const n = ingredient.name.toLowerCase();
  const q = (ingredient.quantity ?? '').toLowerCase().trim();
  if (/\bwasabi\b/.test(n) && /^(?:\d+\s+)?(?:1\/[234]|3\/4|1|2)\s*cups?/.test(q)) {
    return { ...ingredient, quantity: '1 tsp' };
  }
  if (/\btartar sauce\b/.test(n) && /\b1\s*cup\b/.test(q)) {
    return { ...ingredient, quantity: '1/4 cup' };
  }
  return ingredient;
}

// Return a canonical concept key for deduplication. '__skip__' means drop the ingredient.
function isMangoStickyRiceDish(dishName: string): boolean {
  const n = dishName.toLowerCase();
  return /\bmango\b.{0,25}\bsticky rice\b|\bsticky rice\b.{0,25}\bmango\b|\bthai mango\b|\bmango coconut rice\b/i.test(n);
}

function getIngredientConceptKey(name: string, hasSeasonedRiceVinegar: boolean, isMangoRice = false): string {
  const n = name.toLowerCase().trim();
  if (/\bsoy sauce\b/.test(n) || /\btamari\b/.test(n)) return 'soy_sauce';
  if (/\bnori\b/.test(n)) return 'nori';
  if (/\b(scallion|green onion|spring onion)\b/.test(n)) return 'scallion';
  if (/\bchili (oil|crisp)\b/.test(n) || /^spicy chili\b/.test(n)) return 'chili_oil';
  // Seasoned rice vinegar already bundles vinegar+sugar+salt — plain rice vinegar is redundant.
  if (hasSeasonedRiceVinegar && /^rice vinegar$/.test(n)) return '__skip__';
  // Mango sticky rice: merge duplicated fruit, coconut, sugar, salt, and rice variants.
  if (isMangoRice) {
    if (/\bmango\b/.test(n)) return 'mango';
    if (/\bcoconut (milk|cream)\b/.test(n)) return 'coconut_base';
    if (/^(sugar|granulated sugar|palm sugar|white sugar|cane sugar)$/.test(n)) return 'sugar';
    if (/^(salt|sea salt|kosher salt|fine salt)$/.test(n)) return 'salt';
    if (/\b(sticky rice|glutinous rice|sweet rice)\b/.test(n)) return 'sticky_rice';
  }
  return n;
}

// Drop semantic duplicates: soy sauce x2, nori variants, scallion/green onion, etc.
function dedupeIngredientConcepts(ingredients: RecipeIngredient[], analysis?: FoodImageAnalysis): RecipeIngredient[] {
  const hasSeasonedRiceVinegar = ingredients.some((i) => /seasoned rice vinegar/i.test(i.name));
  const isMangoRice = analysis ? isMangoStickyRiceDish(analysis.dishName ?? '') : false;
  const seen = new Set<string>();
  return ingredients.filter((ing) => {
    const key = getIngredientConceptKey(ing.name, hasSeasonedRiceVinegar, isMangoRice);
    if (key === '__skip__') return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRecipeSteps(values: OpenRouterRecipeVariant['steps'], dishName: string) {
  // The provider fail-closes on structurally invalid steps, so by here the AI
  // steps are real. No templated fallback — only clean and de-duplicate the
  // model's own step text.
  const cleanValues = (Array.isArray(values) ? values : [])
    .map(getStepText)
    .map((value) => getShortText(value, '', 240))
    .filter((value) => Boolean(value) && !isPlaceholderText(value))
    .filter((value) => !isGenericGatherStep(value));
  const steps = [...new Set(cleanValues)].slice(0, 16).map(cleanRecipeCopy);

  return ensureSafetyTemperature(steps, dishName);
}

function isGenericGatherStep(step: string) {
  return /^gather\s+(?:all\s+)?(?:your\s+)?(?:the\s+)?ingredients/i.test(step.trim());
}

// Rename "Spam Sushi" → "Spam Musubi" when spam+nori evidence is present.
function maybeRenameMusubi(dishName: string, ingredientText: string): string {
  const name = dishName.toLowerCase();
  if (/\bmusubi\b/.test(name)) return dishName; // already correct
  if (!(/\bspam\b/.test(name) && /\b(sushi|maki)\b/.test(name))) return dishName;
  const text = ingredientText.toLowerCase();
  if (/\bspam\b/.test(text) && /\bnori\b/.test(text)) return 'Spam Musubi';
  return dishName;
}

const GENERIC_STEP_TITLE_RE = /^(combine\s+ingredients?|heat\s+mixture|cool\s+and\s+store|cool\s*&\s*store|gather\s+(?:all\s+)?ingredients?|prepare?\s+ingredients?)$/i;
const MUSUBI_WRONG_STEP_RE = /\bslice\b.{0,25}\b(roll|maki)\b/i;

// Remove generic micro-steps and musubi-incompatible roll steps.
function compressGenericSteps(steps: RecipeStep[], analysis: FoodImageAnalysis): RecipeStep[] {
  const dishText = getAnalysisText(analysis);
  const isMusubi = /musubi/i.test(dishText);
  return steps.filter((step) => {
    const title = (step.title ?? '').trim();
    const text = step.text;
    if (isGenericGatherStep(text)) return false;
    if (isMusubi && (MUSUBI_WRONG_STEP_RE.test(text) || MUSUBI_WRONG_STEP_RE.test(title))) return false;
    // Keep generic-titled steps only when the body contains specific ingredient/amount content.
    if (GENERIC_STEP_TITLE_RE.test(title)) {
      const hasSpecificContent = /\b\d+\s*(tbsp|tsp|cup|oz|lb|g|ml|min|sec|°[FC]|hours?)\b/i.test(text) ||
        /\b(soy sauce|rice vinegar|sugar|mirin|garlic|ginger|sesame|spam|nori|rice|flour|butter|cream|egg)\b/i.test(text);
      if (!hasSpecificContent) return false;
    }
    return true;
  });
}

function getStructuredSteps(
  values: OpenRouterRecipeVariant['steps'],
  steps: string[],
  analysis: FoodImageAnalysis,
  recipeIngredients?: string[],
): RecipeStep[] {
  const aiSteps = (Array.isArray(values) ? values : [])
    .map((value, index) => toStructuredStep(value, steps[index], analysis))
    .filter((step): step is RecipeStep => Boolean(step?.text))
    .slice(0, 16);

  const source = aiSteps.length >= 5
    ? aiSteps
    : steps
      .map((step) => toStructuredStep(step, step, analysis))
      .filter((step): step is RecipeStep => Boolean(step));

  // Remove generic micro-steps (gather ingredients, roll-slicing for musubi, etc.) before ordering.
  const compressed = compressGenericSteps(source, analysis);

  // Validate phase ordering using AI-assigned phase integers (falls back to keyword
  // classification for steps without AI-assigned phase, e.g. old saved recipes).
  const corrected = validateStepPhaseOrder(compressed) ? compressed : correctStepPhaseOrder(compressed);
  if (!validateStepPhaseOrder(corrected)) {
    console.warn('[recipe-validator] phase ordering could not be fully corrected', {
      dishName: analysis.dishName,
    });
  }

  // Fix garnish/cheese/herb steps incorrectly assigned phase 6 by the AI.
  // Those should be phase 5 (Finish); placing them in phase 6 leaves them after Serve.
  const phase6Fixed = fixMisplacedPhase6Steps(corrected);

  // Apply topological sort within each phase group based on creates/requires dependencies.
  const causalCorrected = correctCausalOrder(phase6Fixed);

  // Log any causality violations that survive correction (steps that require
  // objects no earlier step has declared as created).
  const violations = validateCausality(causalCorrected);
  if (violations.length > 0) {
    console.warn('[recipe-causality] dependency violations after correction', {
      dishName: analysis.dishName,
      violations,
    });
  }

  // Deterministic timeline validation: move misplaced steps without modifying text.
  const timelineValidated = validateTimeline(causalCorrected);

  // Ensure ingredient prep (dice/chop/shred…) precedes the first step that uses that ingredient.
  const ingredientValidated = validateIngredientTimeline(timelineValidated);

  // Ensure the final step is always a serving action (phase 6).
  const finalized = ensureServingStep(ingredientValidated, analysis.dishName ?? 'the dish');

  const withFallbacks = ensureStructuredStepFallbacks(finalized, analysis);
  auditStepCoachingQuality(withFallbacks, analysis, analysis.dishName ?? '', recipeIngredients);
  return withFallbacks;
}

type CausalityViolation = {
  stepIndex: number;
  missingObject: string;
};

// Checks that every item in a step's "requires" was declared in "creates" by an earlier step.
// Returns violations found — an empty array means the recipe has causal integrity.
function validateCausality(steps: RecipeStep[]): CausalityViolation[] {
  const created = new Set<string>();
  const violations: CausalityViolation[] = [];
  for (let i = 0; i < steps.length; i++) {
    for (const obj of steps[i].requires ?? []) {
      if (!created.has(obj)) {
        violations.push({ stepIndex: i, missingObject: obj });
      }
    }
    for (const obj of steps[i].creates ?? []) {
      created.add(obj);
    }
  }
  return violations;
}

// Stable topological sort of steps within a single phase group using Kahn's algorithm.
// Steps with no dependency relationships stay in their original relative order.
// If a cycle is detected (should never happen in valid AI output), returns original order.
function topologicalSortWithinPhase(steps: RecipeStep[]): RecipeStep[] {
  if (steps.length <= 1) {
    return steps;
  }

  // Map: object_tag → index of step that creates it
  const createsMap = new Map<string, number>();
  steps.forEach((step, i) => {
    (step.creates ?? []).forEach((obj) => createsMap.set(obj, i));
  });

  // Build adjacency: adj[i] = indices of steps that must come after step i
  const inDegree = new Array(steps.length).fill(0);
  const adj: number[][] = steps.map(() => []);
  for (let j = 0; j < steps.length; j++) {
    for (const obj of steps[j].requires ?? []) {
      const i = createsMap.get(obj);
      if (i !== undefined && i !== j) {
        adj[i].push(j);
        inDegree[j]++;
      }
    }
  }

  // Kahn's — FIFO queue preserves original relative order for independent steps
  const queue: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (inDegree[i] === 0) {
      queue.push(i);
    }
  }

  const result: RecipeStep[] = [];
  while (queue.length > 0) {
    const i = queue.shift()!;
    result.push(steps[i]);
    for (const j of adj[i]) {
      inDegree[j]--;
      if (inDegree[j] === 0) {
        queue.push(j);
      }
    }
  }

  // Cycle detected — return original order rather than a partially sorted result
  return result.length === steps.length ? result : steps;
}

// Applies topological sort within each phase group so that within a phase,
// a step that creates something always appears before steps that require it.
// Between-phase ordering from correctStepPhaseOrder is preserved.
function correctCausalOrder(steps: RecipeStep[]): RecipeStep[] {
  if (steps.length <= 1) {
    return steps;
  }

  // Group steps into consecutive runs of the same effective phase.
  // This preserves the between-phase ordering from correctStepPhaseOrder.
  const runs: RecipeStep[][] = [];
  let currentPhase = -1;
  for (const step of steps) {
    const p = getEffectivePhase(step) || 3;
    if (p !== currentPhase) {
      runs.push([step]);
      currentPhase = p;
    } else {
      runs[runs.length - 1].push(step);
    }
  }

  return runs.flatMap((run) => topologicalSortWithinPhase(run));
}

// Returns the effective phase number for a step.
// Uses the AI-assigned phase integer if present and valid (1-6).
// Falls back to keyword classification for steps from old data or plain-string recipes.
function getEffectivePhase(step: RecipeStep): number {
  const p = step.phase;
  if (p && Number.isInteger(p) && p >= 1 && p <= 6) {
    return p;
  }
  return getStepPhase(step.text);
}

// Returns true if all classified steps appear in non-decreasing phase order.
function validateStepPhaseOrder(steps: RecipeStep[]): boolean {
  let lastPhase = 0;
  for (const step of steps) {
    const phase = getEffectivePhase(step);
    if (phase > 0 && phase < lastPhase) {
      return false;
    }
    if (phase > 0) {
      lastPhase = phase;
    }
  }
  return true;
}

// Stable-sorts steps by effective phase number, preserving relative order within each phase.
// Unclassified steps (phase 0) are placed after cooking (phase 3) as a safe default.
function correctStepPhaseOrder(steps: RecipeStep[]): RecipeStep[] {
  const byPhase = new Map<number, RecipeStep[]>();
  steps.forEach((step) => {
    const p = getEffectivePhase(step) || 3;
    if (!byPhase.has(p)) {
      byPhase.set(p, []);
    }
    byPhase.get(p)!.push(step);
  });
  const result: RecipeStep[] = [];
  for (let p = 1; p <= 6; p++) {
    if (byPhase.has(p)) {
      result.push(...(byPhase.get(p) ?? []));
    }
  }
  return result;
}

// Downgrades phase-6 steps that aren't actual serve/plate actions (e.g. garnish, added
// cheese, fresh herbs) to phase 5, then re-sorts. This fixes the case where the AI
// assigns phase 6 to finishing touches, which stable-sort leaves after the serve step.
function fixMisplacedPhase6Steps(steps: RecipeStep[]): RecipeStep[] {
  const SERVE_RE = /\b(serve|plate(?:\s+and\s+serve)?|enjoy|dish\s+up)\b/i;
  let changed = false;
  const fixed = steps.map((step) => {
    if (step.phase === 6) {
      const text = `${step.title ?? ''} ${step.text}`;
      if (!SERVE_RE.test(text)) {
        changed = true;
        return { ...step, phase: 5 };
      }
    }
    return step;
  });
  return changed ? correctStepPhaseOrder(fixed) : steps;
}

// Lightweight timeline validator. Pure deterministic — only reorders, never modifies text.
// Runs after correctCausalOrder(), before ensureServingStep().
// Rules enforced:
//   2. Serve must be final: post-serve non-cleanup steps move before it
//   3+4. Finishing touches and cooking steps cannot appear after serve
//   5. Phase-1 prep steps cannot appear after phase-2+ cooking steps
//   6. Rest must precede slice (conservative: only within a 5-step window)
function validateTimeline(steps: RecipeStep[]): RecipeStep[] {
  if (steps.length <= 2) return steps;

  const SERVE_RE = /\b(serve|plate(?:\s+and\s+serve)?|enjoy(?:\s+immediately)?|dish\s+up)\b/i;
  const CLEANUP_RE = /\b(clean\s*up|wash\s+(?:the\s+)?dishes?|store\s+leftovers?|refrigerat|freeze\s+(?:for|any))\b/i;
  const COOK_RE = /\b(bake|fry|boil|simmer|saut[eé]|roast|grill|toast|cook|reduce|sear|steam|stir.?fry|caramelize)\b/i;
  const FINISH_RE = /\b(garnish|drizzle|sprinkle|top\s+with|add\s+(?:fresh\s+|grated\s+)?(?:cheese|parmesan|parsley|basil|cilantro|herbs?|scallions?)|finish\s+with|squeeze\s+(?:fresh\s+)?(?:lemon|lime)|season\s+to\s+taste|taste\s+and\s+adjust)\b/i;

  const text = (s: RecipeStep) => `${s.title ?? ''} ${s.text}`;

  // Find the last serve step (phase 6 takes precedence; SERVE_RE is the fallback).
  let serveIdx = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].phase === 6 || SERVE_RE.test(text(steps[i]))) {
      serveIdx = i;
      break;
    }
  }

  let result = steps;

  // Rules 2–4: move post-serve non-cleanup steps to before serve.
  if (serveIdx !== -1 && serveIdx < steps.length - 1) {
    const before = steps.slice(0, serveIdx);
    const serveStep = steps[serveIdx];
    const after = steps.slice(serveIdx + 1);

    const toMove: RecipeStep[] = [];
    const keepAfter: RecipeStep[] = [];
    for (const s of after) {
      (CLEANUP_RE.test(text(s)) ? keepAfter : toMove).push(s);
    }

    if (toMove.length > 0) {
      // Sub-order: cooking steps first, then ambiguous, then finishing touches.
      const cookMoved = toMove.filter(s => COOK_RE.test(text(s)) && !FINISH_RE.test(text(s)));
      const finishMoved = toMove.filter(s => FINISH_RE.test(text(s)));
      const otherMoved = toMove.filter(s => !COOK_RE.test(text(s)) && !FINISH_RE.test(text(s)));
      result = [...before, ...cookMoved, ...otherMoved, ...finishMoved, serveStep, ...keepAfter];
    }
  }

  // Rule 5: phase-1 prep steps appearing after phase-2+ cooking steps → move before first cook.
  const firstCookIdx = result.findIndex(s => (s.phase ?? 0) >= 2);
  if (firstCookIdx > 0) {
    const latePreps = result.slice(firstCookIdx + 1).filter(s => s.phase === 1);
    if (latePreps.length > 0) {
      const prepSet = new Set(latePreps);
      const without = result.filter(s => !prepSet.has(s));
      result = [...without.slice(0, firstCookIdx), ...latePreps, ...without.slice(firstCookIdx)];
    }
  }

  // Rule 6: slice appears before rest → move rest to just before slice (conservative).
  const REST_RE = /\blet\s+(?:it\s+|the\s+\S+\s+)?rest\b|\brest\s+(?:for|the)\b/i;
  const SLICE_RE = /\b(slice|carve)\b/i;
  const restIdx = result.findIndex(s => REST_RE.test(text(s)));
  const sliceIdx = result.findIndex(s => SLICE_RE.test(text(s)));
  if (restIdx !== -1 && sliceIdx !== -1 && sliceIdx < restIdx && restIdx - sliceIdx <= 5) {
    const copy = [...result];
    const [restStep] = copy.splice(restIdx, 1);
    copy.splice(sliceIdx, 0, restStep);
    result = copy;
  }

  // Renumber only if anything moved.
  if (result === steps) return steps;
  return result.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

// Ensures ingredient prep steps (dice, chop, shred…) appear before any step that uses
// that ingredient. Conservative: only moves steps that start with an explicit prep verb,
// and only when the ingredient stem unambiguously appears in an earlier non-prep step.
// No AI calls, no text modification. Renumbers only when steps actually move.
function validateIngredientTimeline(steps: RecipeStep[]): RecipeStep[] {
  if (steps.length <= 2) return steps;

  const PREP_RE = /^(?:dice|chop|mince|slice|shred|grate|peel|trim|julienne|halve|quarter|zest|crush|pound|wash|rinse|drain|crumble|tear)\b/i;
  const SKIP = new Set(['the','and','with','into','them','your','then','over','from','some','each','until','this','that','finely','roughly','thinly','small','large','fresh','dried','well','into','about']);

  const txt = (s: RecipeStep) => `${s.title ?? ''} ${s.text}`;

  // Returns a stable ingredient stem from the prep step text, or null if not a prep step.
  function ingredientStem(s: RecipeStep): string | null {
    if (!PREP_RE.test(s.text.trim())) return null;
    const words = txt(s).toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
      .filter(w => w.length >= 5 && !SKIP.has(w) && !PREP_RE.test(w));
    const tok = words[0];
    if (!tok) return null;
    // Stem: drop last 2 chars to absorb -s/-es, but keep at least 5.
    return tok.slice(0, Math.max(5, tok.length - 2));
  }

  let result = [...steps];
  let anyMoved = false;

  // Each pass fixes the first detected violation; bounded by steps.length.
  for (let guard = 0; guard < steps.length; guard++) {
    let moved = false;
    for (let i = 1; i < result.length; i++) {
      const stem = ingredientStem(result[i]);
      if (!stem) continue;
      const re = new RegExp(`\\b${stem}`, 'i');
      for (let j = 0; j < i; j++) {
        if (PREP_RE.test(result[j].text.trim())) continue; // skip other prep steps
        if (re.test(txt(result[j]))) {
          const [step] = result.splice(i, 1);
          result.splice(j, 0, step);
          anyMoved = true;
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) break;
  }

  if (!anyMoved) return steps;
  return result.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

// Ensures the recipe ends with a serving step (phase 6).
// Only appends a generic serving step when no finish/serve step exists anywhere.
function ensureServingStep(steps: RecipeStep[], dishName: string): RecipeStep[] {
  if (steps.length === 0) {
    return steps;
  }
  const lastPhase = getEffectivePhase(steps[steps.length - 1]);
  if (lastPhase >= 5) {
    return steps;
  }
  const hasServingStep = steps.some((s) => getEffectivePhase(s) >= 5);
  if (hasServingStep) {
    return steps;
  }
  return [...steps, {
    phase: 6,
    title: 'Serve and enjoy',
    text: `Plate ${dishName} and serve immediately while hot.`,
  }];
}

// Keyword-based phase classification — fallback only for steps without AI-assigned phase.
// Used by getEffectivePhase() when step.phase is absent (old saved recipes, plain-string steps).
//   1 = Preparation   (wash, slice, chop, mince, dice, measure, prep)
//   2 = Setup / Cook  (heat, preheat, cook, fry, boil, roast, bake, sear, sauté)
//   3 = Sauce         (whisk sauce, stir sauce, mix sauce, simmer sauce)
//   4 = Assemble      (combine, build, layer, add to bowl, top with)
//   5 = Finish        (drizzle, garnish, sprinkle, scatter, squeeze, fresh herb)
//   6 = Serve         (serve, plate, enjoy)
function getStepPhase(text: string): number {
  const t = text.toLowerCase();
  if (/\b(serve|plate and serve|enjoy immediately|serve immediately|serve warm|serve right away)\b/.test(t)) {
    return 6;
  }
  if (/\bdrizzle\b|\bgarnish\b|\bscatter\b|\bsprinkle on top\b|\bsqueeze (?:fresh |a )?(lemon|lime|citrus)\b|\bfinish(?:ing)? with\b|\badd fresh (herbs?|basil|cilantro|parsley|scallions)\b/.test(t)) {
    return 5;
  }
  if (/\b(combine|build|assemble|layer|add (?:the )?(?:chicken|beef|pork|shrimp|tempura|rice|noodles|veggies|vegetables|toppings) to (?:the )?(?:bowl|plate|dish|pan)|arrange|top with|place (?:on top|in (?:the )?bowl))\b/.test(t)) {
    return 4;
  }
  if (/\b(whisk|stir together|mix together).{0,40}(sauce|dressing|glaze|marinade)\b|\b(sauce|dressing|glaze)\b.{0,30}\b(whisk|stir|mix|combine|simmer|reduce)\b/.test(t)) {
    return 3;
  }
  if (/\b(cook|fry|boil|roast|bake|sear|sauté|saute|grill|steam|pan-fry|deep-fry|air-fry|toast|brown|caramelize|reduce|simmer).{0,60}\b(chicken|beef|pork|shrimp|tofu|tempura|fish|salmon|eggs?|noodles?|pasta|rice|vegetables?|veggies|onion|pepper|broccoli|spinach)\b|\b(heat|warm).{0,20}(oil|pan|skillet|wok|butter)\b|\b(chicken|beef|pork|shrimp|tofu|fish|salmon|eggs?|noodles?|pasta|rice|vegetables?|veggies)\b.{0,60}\b(cook|fry|boil|roast|bake|sear|golden|done|tender|crispy)\b/.test(t)) {
    return 2;
  }
  if (/\b(wash|rinse|dry|pat dry|slice|chop|dice|mince|crush|grate|shred|peel|trim|cut|halve|quarter|zest|julienne|measure|set out|prep|combine.{0,20}(in a bowl|in a dish|in a cup)|mix together.{0,20}(seasoning|spice|rub))\b/.test(t)) {
    return 1;
  }
  return 0; // unclassified — leave in place
}

// Merges coaching patches from the AI repair pass into existing structured steps.
//
// Safer merge: a patched field is applied ONLY if that field was flagged weak for
// this step. The repair model is told to return only the requested fields, but it
// sometimes volunteers extra ones — without this gate a repair could overwrite a
// strong original (e.g. a good chefTip) with a weaker rewrite, and the aggregate
// `finalScore >= initialScore` guard wouldn't catch it because scoring is
// presence-based. Companion fields travel with their trigger: regenerating a
// commonQuestion must bring its answer; a new decisionPoint must bring ifYes/ifNo.
function applyCoachingPatches(
  steps: RecipeStep[],
  patches: StepCoachingPatch[],
  weaknesses: { stepIndex: number; weakFields: string[] }[],
): RecipeStep[] {
  const weakByIndex = new Map(weaknesses.map((w) => [w.stepIndex, new Set(w.weakFields)]));

  return steps.map((step, idx) => {
    const patch = patches.find((p) => p.index === idx);
    if (!patch) return step;

    const weak = new Set(weakByIndex.get(idx) ?? []);
    // Forward companion expansion only — never the reverse, so a missing answer
    // alone can't trigger a rewrite of an otherwise-good question.
    if (weak.has('commonQuestion')) weak.add('commonQuestionAnswer');
    if (weak.has('decisionPoint')) { weak.add('ifYes'); weak.add('ifNo'); }

    // Apply patch value only when (a) the field was flagged weak and (b) the
    // patch actually provides non-empty text; otherwise keep the original.
    const take = (field: string, patchVal?: string): string | undefined =>
      (weak.has(field) && patchVal?.trim()) ? patchVal : undefined;

    return {
      ...step,
      decisionPoint: take('decisionPoint', patch.decisionPoint) ?? step.decisionPoint,
      ifYes: take('ifYes', patch.ifYes) ?? step.ifYes,
      ifNo: take('ifNo', patch.ifNo) ?? step.ifNo,
      why: take('why', patch.why) ?? step.why,
      commonMistake: take('commonMistake', patch.commonMistake) ?? step.commonMistake,
      chefTip: take('chefTip', patch.chefTip) ?? step.chefTip,
      commonQuestion: take('commonQuestion', patch.commonQuestion) ?? step.commonQuestion,
      commonQuestionAnswer: take('commonQuestionAnswer', patch.commonQuestionAnswer) ?? step.commonQuestionAnswer,
      lookFor: take('lookFor', patch.lookFor) ?? step.lookFor,
      doneWhen: take('doneWhen', patch.doneWhen) ?? step.doneWhen,
    };
  });
}

// Identifies steps with missing or weak coaching fields and returns a list of
// targeted weaknesses for the repair loop. Avoids flagging every step in a phase
// for the same field — only the first occurrence per phase is flagged so repairs
// are focused rather than redundant.
function identifyCoachingWeaknesses(
  steps: RecipeStep[],
): { stepIndex: number; weakFields: string[] }[] {
  // Track which phases already have a question/decision in forward order —
  // built during the loop, not pre-scanned. Pre-scanning caused a late-step
  // question to protect earlier steps that chronologically lack one.
  // Phased steps use the phase number; unphased steps use the sentinel -1.
  const phasesWithQuestion = new Set<number>();
  const phasesWithDecision = new Set<number>();

  const weaknesses: { stepIndex: number; weakFields: string[] }[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const weakFields: string[] = [];
    const stepTextLower = `${step.title ?? ''} ${step.text}`.toLowerCase();
    const isCookingStep = step.phase === 3 || PHASE_COOKING_VERBS_RE.test(stepTextLower);
    const phaseKey = step.phase ?? -1;

    // Mark this phase as covered before the gap checks so a step with both
    // a question and a cooking verb doesn't flag itself.
    if (step.commonQuestion) phasesWithQuestion.add(phaseKey);
    if (step.decisionPoint) phasesWithDecision.add(phaseKey);

    if (!step.why && !step.whyItMatters) {
      weakFields.push('why');
    }

    if (!step.chefTip || step.chefTip.length < 20) {
      weakFields.push('chefTip');
    }

    // Flag the first cooking step per phase (including unphased) that lacks commonQuestion.
    if (isCookingStep && !step.commonQuestion && !phasesWithQuestion.has(phaseKey)) {
      weakFields.push('commonQuestion');
      phasesWithQuestion.add(phaseKey);
    }

    // Flag orphaned commonQuestion — renders as an unanswerable prompt in the UI.
    if (step.commonQuestion && !step.commonQuestionAnswer) {
      weakFields.push('commonQuestionAnswer');
    }

    // Flag the first cooking step per phase (including unphased) that lacks a decisionPoint.
    if (isCookingStep && !step.decisionPoint && !phasesWithDecision.has(phaseKey)) {
      weakFields.push('decisionPoint');
      phasesWithDecision.add(phaseKey);
    }

    // Flag incomplete decisionPoint — branches are required for the score to count it.
    if (step.decisionPoint && (!step.ifYes || !step.ifNo)) {
      weakFields.push('ifYes');
      weakFields.push('ifNo');
    }

    // A lookFor with text but no observable signal (color/texture/temp/physical
    // test) is vague. Temperature readings now count, so "Reads 165°F" is kept.
    if (step.lookFor && !hasObservableSignal(step.lookFor)) {
      weakFields.push('lookFor');
    }

    // Flag timer-only doneWhen on active cooking steps — passive steps (rest,
    // chill, marinate) are legitimately time-based and should not be flagged.
    if (isCookingStep && step.doneWhen) {
      const hasObservable = hasObservableSignal(step.doneWhen);
      const hasOnlyTimer = !hasObservable && /\b\d+\s*(?:min|sec|minute|second|hour)/.test(step.doneWhen.toLowerCase());
      if (hasOnlyTimer) {
        weakFields.push('doneWhen');
      }
    }

    if (weakFields.length > 0) {
      weaknesses.push({ stepIndex: i, weakFields });
    }
  }

  return weaknesses;
}

function logCoachingTrends(data: {
  model: string;
  category: string;
  dishName: string;
  initialScore: number;
  finalScore: number;
  repairApplied: boolean;
  weakFieldTypes?: string[];
}): void {
  const delta = data.finalScore - data.initialScore;
  console.log('[recipe-quality] coaching trends', {
    model: data.model,
    category: data.category,
    dish: data.dishName,
    initialScore: data.initialScore,
    finalScore: data.finalScore,
    delta: delta > 0 ? `+${delta}` : String(delta),
    repairApplied: data.repairApplied,
    ...(data.weakFieldTypes?.length ? { weakFieldTypes: [...new Set(data.weakFieldTypes)] } : {}),
  });
}

function synthesizeStepImagePrompt(data: StepImagePromptData): string | undefined {
  const { subject, action, vessel, visualState, cameraAngle, style } = data;
  if (!subject || !action) return undefined;
  const parts: string[] = [`${subject} ${action}`];
  if (vessel) parts.push(`in a ${vessel}`);
  if (visualState) parts.push(visualState);
  if (cameraAngle) parts.push(`${cameraAngle} angle`);
  if (style) parts.push(style);
  return parts.join(', ');
}

function toStructuredStep(
  value: OpenRouterRecipeVariant['steps'][number],
  fallbackText: string | undefined,
  analysis: FoodImageAnalysis,
): RecipeStep | undefined {
  const text = cleanRecipeCopy(getShortText(getStepText(value), fallbackText ?? '', 260));
  if (!text) {
    return undefined;
  }

  if (typeof value === 'object' && value) {
    const cookingTerm = value.cookingTerm?.term && value.cookingTerm?.meaning
      ? {
        term: cleanRecipeCopy(getShortText(value.cookingTerm.term, '', 32)),
        meaning: cleanRecipeCopy(getShortText(value.cookingTerm.meaning, '', 90)),
      }
      : getContextCookingTerm(text);

    const title = value.title ? cleanRecipeCopy(getShortText(value.title, '', 48)) : undefined;
    const rawPhase = typeof value.phase === 'number' ? value.phase : undefined;
    const phase = rawPhase && Number.isInteger(rawPhase) && rawPhase >= 1 && rawPhase <= 6
      ? rawPhase
      : undefined;
    const creates = Array.isArray(value.creates)
      ? value.creates.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
      : undefined;
    const requires = Array.isArray(value.requires)
      ? value.requires.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
      : undefined;
    const lookFor = getOptionalStepText(value.lookFor, 180);
    const doneWhen = getOptionalStepText(value.doneWhen, 220);
    const chefTip = getOptionalStepText(value.chefTip, 200);
    // Prefer the canonical per-step `ingredients`/`tools`; fall back to the
    // legacy `ingredientsUsed`/`toolsUsed` names for older outputs.
    const ingredientsSource = Array.isArray(value.ingredients) && value.ingredients.length
      ? value.ingredients
      : (Array.isArray(value.ingredientsUsed) ? value.ingredientsUsed : []);
    const ingredientsUsed = ingredientsSource
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 12);
    const toolsSource = Array.isArray(value.tools) && value.tools.length
      ? value.tools
      : (Array.isArray(value.toolsUsed) ? value.toolsUsed : []);
    const rawToolsUsed = toolsSource
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    const detectedTools = rawToolsUsed.length === 0 ? detectToolsFromStep(text) : [];
    const toolsUsed = [...new Set([...rawToolsUsed, ...detectedTools])].slice(0, 6);
    const rawPromptData = value.stepImagePromptData && typeof value.stepImagePromptData === 'object'
      ? value.stepImagePromptData as StepImagePromptData
      : undefined;
    const stepImagePromptData = rawPromptData?.subject && rawPromptData?.action ? rawPromptData : undefined;
    const stepImagePrompt = getOptionalStepText(value.stepImagePrompt, 220)
      ?? (stepImagePromptData ? synthesizeStepImagePrompt(stepImagePromptData) : undefined);
    const why = getOptionalStepText(value.why, 160);
    const commonMistake = getOptionalStepText(value.commonMistake, 160);
    const commonQuestion = getOptionalStepText(value.commonQuestion, 160);
    const commonQuestionAnswer = getOptionalStepText(value.commonQuestionAnswer, 200);
    const decisionPoint = getOptionalStepText(value.decisionPoint, 140);
    const ifYes = getOptionalStepText(value.ifYes, 100);
    const ifNo = getOptionalStepText(value.ifNo, 120);
    const rawMinutes = typeof value.estimatedMinutes === 'number' ? value.estimatedMinutes : undefined;
    const estimatedMinutes = rawMinutes && Number.isInteger(rawMinutes) && rawMinutes > 0 && rawMinutes <= 180
      ? rawMinutes
      : undefined;

    return {
      phase,
      title: title || undefined,
      text,
      creates: creates?.length ? creates : undefined,
      requires: requires?.length ? requires : undefined,
      lookFor: lookFor ?? undefined,
      doneWhen: doneWhen ?? undefined,
      chefTip: chefTip ?? undefined,
      ingredientsUsed: ingredientsUsed?.length ? ingredientsUsed : undefined,
      toolsUsed: toolsUsed.length ? toolsUsed : undefined,
      stepImagePrompt: stepImagePrompt ?? undefined,
      stepImagePromptData: stepImagePromptData ?? undefined,
      why: why ?? undefined,
      commonMistake: commonMistake ?? undefined,
      commonQuestion: commonQuestion ?? undefined,
      commonQuestionAnswer: commonQuestionAnswer ?? undefined,
      decisionPoint: decisionPoint ?? undefined,
      ifYes: ifYes ?? undefined,
      ifNo: ifNo ?? undefined,
      estimatedMinutes,
      timeEstimate: cleanRecipeCopy(getShortText(value.timeEstimate, getStepTimeEstimate(text), 42)),
      visualCue: getOptionalStepText(value.visualCue, 110) ?? getStepVisualCue(text),
      whyItMatters: getOptionalStepText(value.whyItMatters, 120),
      safetyNote: getOptionalStepText(value.safetyNote, 120) ?? getStepSafetyNote(text, analysis),
      flavorBoost: getOptionalStepText(value.flavorBoost, 120) ?? getStepFlavorBoost(text, analysis),
      cookingTerm,
    };
  }

  return {
    text,
    title: deriveTitleFromInstruction(text) || undefined,
    timeEstimate: getStepTimeEstimate(text),
    visualCue: getStepVisualCue(text),
    safetyNote: getStepSafetyNote(text, analysis),
    flavorBoost: getStepFlavorBoost(text, analysis),
    cookingTerm: getContextCookingTerm(text),
  };
}

// Scores a recipe 0-100 based on how many of the 11 key coaching fields are
// populated per step. A score ≥ 75 indicates a well-coached recipe.
// A doneWhen counts toward the coaching score only when it's a genuine completion
// signal. Active cooking steps need an observable cue (color/texture/temp/physical
// test); a bare timer does not qualify. Passive steps (rest, chill, marinate) may
// legitimately rely on time, so for those, presence is enough.
function doneWhenCountsTowardScore(step: RecipeStep): boolean {
  if (!step.doneWhen) return false;
  const stepTextLower = `${step.title ?? ''} ${step.text}`.toLowerCase();
  const isCookingStep = step.phase === 3 || PHASE_COOKING_VERBS_RE.test(stepTextLower);
  if (!isCookingStep) return true;
  return hasObservableSignal(step.doneWhen);
}

export function calculateRecipeCoachingScore(steps: RecipeStep[]): number {
  if (steps.length === 0) return 0;
  let total = 0;
  for (const step of steps) {
    let score = 0;
    if (step.title?.trim()) score++;
    if (step.why || step.whyItMatters) score++;
    if (step.commonMistake || step.safetyNote) score++;
    if (step.lookFor) score++;
    // doneWhen earns credit only when it's a real completion signal. On an active
    // cooking step, a bare timer ("cook 5 minutes") is not — it would inflate the
    // score without telling the cook what done looks like. Passive steps (rest,
    // chill, marinate) legitimately use time, so they still count on presence.
    if (step.doneWhen && doneWhenCountsTowardScore(step)) score++;
    if (step.chefTip) score++;
    if (step.commonQuestion && step.commonQuestionAnswer) score++;
    if (step.ingredientsUsed?.length) score++;
    if (step.toolsUsed?.length) score++;
    if (step.stepImagePrompt) score++;
    if (step.decisionPoint && step.ifYes && step.ifNo) score++;
    total += (score / 11) * 100;
  }
  return Math.round(total / steps.length);
}

function ensureStructuredStepFallbacks(steps: RecipeStep[], analysis: FoodImageAnalysis) {
  return steps.map((step) => ({
    ...step,
    timeEstimate: step.timeEstimate || getStepTimeEstimate(step.text),
    visualCue: step.visualCue || getStepVisualCue(step.text),
    safetyNote: step.safetyNote || getStepSafetyNote(step.text, analysis),
    flavorBoost: step.flavorBoost || getStepFlavorBoost(step.text, analysis),
    cookingTerm: step.cookingTerm ?? getContextCookingTerm(step.text),
  }));
}

function getStepText(value: OpenRouterRecipeVariant['steps'][number] | undefined) {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    // Prefer the canonical `step` field, then legacy `instruction`/`text`.
    return value.step || value.instruction || value.text;
  }

  return '';
}

function getOptionalStepText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim()
    ? cleanRecipeCopy(getShortText(value, '', maxLength))
    : undefined;
}

function getStepTimeEstimate(step: string) {
  const match = step.match(/\b\d+(?:-\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
  return match?.[0] ?? 'about 2-5 minutes';
}

function getStepVisualCue(step: string): string | undefined {
  const normalized = step.toLowerCase();
  if (includesAny(normalized, ['brown', 'browned', 'golden'])) {
    return 'Look for deep browning, not gray or pale spots.';
  }
  if (includesAny(normalized, ['glossy', 'smooth', 'coats'])) {
    return 'The sauce should look smooth and cling to the food.';
  }
  if (includesAny(normalized, ['sizzle', 'sizzles'])) {
    return 'The pan should sizzle when food touches it.';
  }
  if (includesAny(normalized, ['fragrant', 'smells'])) {
    return 'It should smell rich and toasted, not burnt.';
  }

  return undefined;
}

function getStepSafetyNote(step: string, analysis: FoodImageAnalysis) {
  const text = `${step} ${getAnalysisText(analysis)}`.toLowerCase();
  if (includesAny(text, ['burger', 'ground beef', 'ground turkey', 'patty', 'patties'])) {
    return text.includes('160') ? undefined : 'Ground beef or turkey should reach 160°F / 71°C inside.';
  }
  if (text.includes('chicken')) {
    return text.includes('165') ? undefined : 'Chicken should reach 165°F / 74°C inside.';
  }

  return undefined;
}

function getStepFlavorBoost(step: string, _analysis: FoodImageAnalysis) {
  const text = step.toLowerCase();
  if (includesAny(text, ['sauce', 'mayo', 'mayonnaise', 'ketchup', 'mustard'])) {
    return 'Optional boost: add pickle juice, smoked paprika, or extra mustard for restaurant-style flavor.';
  }
  if (includesAny(text, ['pasta', 'noodle', 'rigatoni', 'sauce'])) {
    return 'Optional boost: finish with black pepper, basil, or a little parmesan.';
  }
  if (includesAny(text, ['serve', 'finish', 'garnish'])) {
    return 'Optional boost: add a fresh herb, citrus squeeze, or tiny pinch of spice.';
  }

  return undefined;
}

function getContextCookingTerm(step: string): CookingTerm | undefined {
  const normalized = step.toLowerCase();
  if (normalized.includes('sear')) {
    return { term: 'Sear', meaning: 'Cook over high heat until browned.' };
  }
  if (normalized.includes('simmer')) {
    return { term: 'Simmer', meaning: 'Cook gently with small bubbles.' };
  }
  if (normalized.includes('fold')) {
    return { term: 'Fold', meaning: 'Gently combine without mashing or overmixing.' };
  }
  if (normalized.includes('deglaze')) {
    return { term: 'Deglaze', meaning: 'Add liquid and scrape browned bits into the sauce.' };
  }
  if (normalized.includes('rest')) {
    return { term: 'Rest', meaning: 'Let cooked food sit briefly so juices settle.' };
  }
  if (normalized.includes('al dente')) {
    return { term: 'Al dente', meaning: 'Tender pasta with a slight bite.' };
  }

  return undefined;
}

function ensureSafetyTemperature(steps: string[], dishName: string) {
  const dishText = dishName.toLowerCase();
  if (isDrinkAnalysisText(dishText)) {
    return steps;
  }
  const stepText = steps.join(' ').toLowerCase();

  if (dishText.includes('burger') && !stepText.includes('160')) {
    return steps.map((step) => (
      step.toLowerCase().includes('patty') || step.toLowerCase().includes('patties')
        ? `${step} For ground beef or turkey, check for 160°F inside.`
        : step
    ));
  }
  if (dishText.includes('chicken') && !stepText.includes('165')) {
    return steps.map((step) => (
      step.toLowerCase().includes('chicken')
        ? `${step} Chicken should reach 165°F inside.`
        : step
    ));
  }

  return steps;
}

function getIngredientGroups(
  values: OpenRouterRecipeVariant['ingredientGroups'],
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
): RecipeIngredientGroup[] {
  const aiGroups = (Array.isArray(values) ? values : [])
    .map((group) => ({
      component: titleCase(getShortText(group.component, '', 36)),
      items: getSafeList(group.items, [], 15).map(toRecipeIngredient),
    }))
    .filter((group) => group.component && group.items.length > 0)
    .slice(0, 12);

  if (aiGroups.length > 0) {
    return aiGroups;
  }

  return getDefaultIngredientGroups(ingredients, analysis);
}

function getDefaultIngredientGroups(
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
): RecipeIngredientGroup[] {
  const dishText = getAnalysisText(analysis);
  const componentNames = getDefaultComponents(dishText);
  const grouped = componentNames.map((component) => ({
    component,
    items: ingredients.filter((ingredient) => getComponentForIngredient(ingredient, dishText) === component),
  }));
  const usedNames = new Set(grouped.flatMap((group) => group.items.map((item) => item.name)));
  const remaining = ingredients.filter((ingredient) => !usedNames.has(ingredient.name));

  if (remaining.length > 0) {
    grouped.push({ component: 'Finishing', items: remaining });
  }

  return grouped.filter((group) => group.items.length > 0).slice(0, 4);
}

function getDefaultComponents(dishText: string) {
  if (dishText.includes('burger')) {
    return ['Patty', 'Sauce', 'Toppings', 'Assembly'];
  }
  if (dishText.includes('noodle') || dishText.includes('pasta') || dishText.includes('rigatoni')) {
    return ['Noodles', 'Sauce', 'Protein/veg', 'Garnish'];
  }
  if (dishText.includes('pizza')) {
    return ['Crust', 'Sauce', 'Cheese', 'Toppings'];
  }
  if (dishText.includes('sushi') || dishText.includes('nigiri') || dishText.includes('maki') || dishText.includes('roll')) {
    return ['Sushi Rice', 'Nigiri', 'Rolls', 'Condiments & Sides'];
  }
  if (
    dishText.includes('platter') || dishText.includes('board') || dishText.includes('bento') ||
    dishText.includes('tapas') || dishText.includes('mezze') || dishText.includes('dim sum') ||
    dishText.includes('charcuterie') || dishText.includes('spread')
  ) {
    return ['Main Items', 'Sides', 'Sauces & Dips', 'Garnish'];
  }
  if (dishText.includes('bowl') || dishText.includes('salad')) {
    return ['Base', 'Protein/veg', 'Sauce', 'Garnish'];
  }

  return ['Main', 'Sauce', 'Toppings', 'Finishing'];
}

function getComponentForIngredient(ingredient: RecipeIngredient, dishText: string) {
  const name = ingredient.name.toLowerCase();

  if (dishText.includes('burger')) {
    if (includesAny(name, ['beef', 'turkey', 'patty', 'patties', 'veggie'])) {
      return 'Patty';
    }
    if (includesAny(name, ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'sauce'])) {
      return 'Sauce';
    }
    if (includesAny(name, ['lettuce', 'tomato', 'onion', 'pickle', 'cheese'])) {
      return 'Toppings';
    }
    return 'Assembly';
  }

  if (dishText.includes('noodle') || dishText.includes('pasta') || dishText.includes('rigatoni')) {
    if (includesAny(name, ['noodle', 'pasta', 'rigatoni', 'spaghetti'])) {
      return 'Noodles';
    }
    if (includesAny(name, ['sauce', 'paste', 'cream', 'soy', 'gochujang', 'butter'])) {
      return 'Sauce';
    }
    if (includesAny(name, ['chicken', 'beef', 'tofu', 'spinach', 'mushroom', 'broccoli'])) {
      return 'Protein/veg';
    }
    return 'Garnish';
  }

  if (dishText.includes('pizza')) {
    if (includesAny(name, ['dough', 'crust', 'flatbread'])) {
      return 'Crust';
    }
    if (includesAny(name, ['sauce', 'marinara', 'tomato paste'])) {
      return 'Sauce';
    }
    if (includesAny(name, ['cheese', 'mozzarella', 'parmesan'])) {
      return 'Cheese';
    }
    return 'Toppings';
  }

  if (includesAny(name, ['sauce', 'dressing', 'hummus', 'mayo', 'gochujang'])) {
    return 'Sauce';
  }
  if (includesAny(name, ['cilantro', 'parsley', 'basil', 'sesame', 'lime', 'lemon', 'herb'])) {
    return 'Garnish';
  }
  if (includesAny(name, ['chicken', 'beef', 'tofu', 'falafel', 'greens', 'cucumber', 'tomato'])) {
    return 'Protein/veg';
  }

  return 'Main';
}

function getDefaultMainIngredientsSummary(ingredients: RecipeIngredient[]) {
  const names = ingredients
    .filter((ingredient) => !ingredient.pantryItem)
    .map((ingredient) => ingredient.name)
    .slice(0, 5);

  return names.length > 0 ? names.join(', ') : 'Flexible home-kitchen ingredients';
}

function getDefaultEquipment(analysis: FoodImageAnalysis) {
  const dishText = getAnalysisText(analysis);

  if (isDrinkAnalysisText(dishText)) {
    return ['blender or whisk', 'measuring cup', 'tall glass'];
  }
  if (dishText.includes('burger')) {
    return ['skillet or grill pan', 'spatula', 'instant-read thermometer', 'knife and cutting board'];
  }
  if (dishText.includes('pasta') || dishText.includes('noodle') || dishText.includes('rigatoni')) {
    return ['large pot', 'skillet', 'tongs or spoon', 'measuring cup'];
  }
  if (dishText.includes('pizza')) {
    return ['sheet pan', 'oven', 'knife or pizza cutter'];
  }

  return ['skillet or pot', 'knife and cutting board', 'mixing spoon'];
}

function getDefaultBestFor() {
  return 'home cooking';
}

function getDefaultAvoidMistake(analysis: FoodImageAnalysis) {
  const dishText = getAnalysisText(analysis);

  if (isDrinkAnalysisText(dishText)) {
    return 'Do not over-blend with too much ice; it waters down the flavor fast.';
  }
  if (dishText.includes('burger')) {
    return 'Do not press the patty hard while it cooks; that squeezes out juices.';
  }
  if (dishText.includes('pasta') || dishText.includes('noodle') || dishText.includes('rigatoni')) {
    return 'Do not drain all the pasta water; a splash helps the sauce cling.';
  }
  if (dishText.includes('pizza')) {
    return 'Do not overload toppings, or the crust can turn soggy.';
  }

  return 'Do not rush seasoning; taste once before serving and adjust in small pinches.';
}

function getDefaultStorageAndReheating(analysis: FoodImageAnalysis) {
  const dishText = getAnalysisText(analysis);

  if (isDrinkAnalysisText(dishText)) {
    return 'Best enjoyed right away. Refrigerate up to 24 hours and shake or stir before drinking.';
  }
  if (dishText.includes('burger')) {
    return 'Store cooked patties and toppings separately up to 3 days. Reheat patties in a skillet until hot.';
  }
  if (dishText.includes('pasta') || dishText.includes('noodle') || dishText.includes('rigatoni')) {
    return 'Store up to 3 days. Reheat with a splash of water or milk to loosen the sauce.';
  }

  return 'Store leftovers in a sealed container up to 3 days. Reheat gently until hot.';
}

function getGroceryItems(
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
): GroceryListItem[] {
  const dishText = getAnalysisText(analysis);
  const convertedItems = ingredients.flatMap((ingredient) => toGroceryItems(ingredient));
  const withCoreItems = ensureCoreGroceryItems(convertedItems, dishText);

  // ponytail: 12 for single dishes, 30 for platters; dedup handles the overlap
  const isPlatter = ingredients.length > 12 || dishText.includes('platter') || dishText.includes('sushi') || dishText.includes('bento') || dishText.includes('board');
  return dedupeGroceryItems(withCoreItems).slice(0, isPlatter ? 30 : 12);
}

function normalizeGroceryCategory(value: string, itemName: string): GroceryCategory {
  const normalized = value.trim().toLowerCase();
  const allowed: GroceryCategory[] = [
    'Produce',
    'Protein',
    'Bakery / Bread',
    'Dairy',
    'Sauces / Condiments',
    'Pantry',
    'Spices',
    'Noodles / Grains',
    'Garnish',
  ];
  const match = allowed.find((category) => category.toLowerCase() === normalized);
  if (match) {
    return match;
  }

  return getGroceryCategory({ name: itemName, quantity: '' });
}

function toGroceryItems(ingredient: RecipeIngredient): GroceryListItem[] {
  const name = ingredient.name.toLowerCase();

  if (name.includes('tomato paste')) {
    return [createGroceryItem('tomato paste', '1 small can or tube', 'Pantry', ingredient)];
  }
  if (name.includes('lettuce') && name.includes('tomato')) {
    return [
      createGroceryItem('tomato', '1', 'Produce', ingredient, 'Slice what you need for the burger.'),
      createGroceryItem('romaine or lettuce', '1 small head or 1 bag', 'Produce', ingredient, 'Use a few leaves for serving.'),
    ];
  }
  if (includesAny(name, ['tomato slice', 'tomato slices', 'tomato'])) {
    return [createGroceryItem('tomato', '1', 'Produce', ingredient, 'Slice what you need for the recipe.')];
  }
  if (includesAny(name, ['lettuce leaf', 'lettuce leaves', 'lettuce', 'romaine'])) {
    return [createGroceryItem('romaine or lettuce', '1 small head or 1 bag', 'Produce', ingredient, 'Use a few leaves for serving.')];
  }
  if (includesAny(name, ['burger bun', 'burger buns', 'brioche bun', 'roll'])) {
    return [createGroceryItem('burger buns', '1 pack', 'Bakery / Bread', ingredient)];
  }
  if (includesAny(name, ['ground beef', 'ground turkey'])) {
    return [createGroceryItem(name.includes('turkey') ? 'ground turkey' : 'ground beef', getMeatShoppingQuantity(ingredient.quantity), 'Protein', ingredient)];
  }
  if (includesAny(name, ['burger patty', 'burger patties', 'veggie burger', 'veggie patties'])) {
    return [createGroceryItem(ingredient.name, '2 patties or 8 oz', 'Protein', ingredient)];
  }
  if (includesAny(name, ['cheese slice', 'cheese slices', 'sliced cheddar', 'american cheese', 'cheddar'])) {
    return [createGroceryItem('sliced cheddar or American cheese', '2 slices or 1 small pack', 'Dairy', ingredient)];
  }
  if (includesAny(name, ['mayonnaise', 'mayo', 'ketchup', 'mustard', 'burger sauce'])) {
    return [createGroceryItem(ingredient.name, '', 'Sauces / Condiments', ingredient, 'Small jar or bottle if you do not have it.')];
  }
  if (includesAny(name, ['salt', 'black pepper', 'red pepper flakes', 'garlic powder', 'paprika', 'seasoning'])) {
    return [createGroceryItem(ingredient.name, 'pantry check', 'Spices', ingredient)];
  }
  if (name.includes('oil')) {
    return [createGroceryItem(ingredient.name, '1 tbsp', 'Pantry', ingredient)];
  }
  if (name.includes('hummus')) {
    return [createGroceryItem('hummus', '1 small tub', 'Sauces / Condiments', ingredient)];
  }
  if (includesAny(name, ['harissa dressing', 'dressing'])) {
    return [createGroceryItem(ingredient.name, '1 small bottle', 'Sauces / Condiments', ingredient)];
  }
  if (includesAny(name, ['greens', 'spinach', 'arugula', 'kale'])) {
    return [createGroceryItem(ingredient.name, '1 small bag', 'Produce', ingredient)];
  }
  if (name.includes('cucumber')) {
    return [createGroceryItem('cucumber', '1', 'Produce', ingredient)];
  }
  if (name.includes('onion')) {
    return [createGroceryItem('onion', '1 small', 'Produce', ingredient)];
  }
  if (name.includes('pickle')) {
    return [createGroceryItem('pickles', '1 small jar', 'Sauces / Condiments', ingredient)];
  }
  if (includesAny(name, ['pasta', 'rigatoni', 'spaghetti', 'noodle', 'noodles', 'rice', 'grain', 'quinoa'])) {
    return [createGroceryItem(ingredient.name, ingredient.quantity, 'Noodles / Grains', ingredient)];
  }

  return [createGroceryItem(ingredient.name, ingredient.quantity, getGroceryCategory(ingredient), ingredient)];
}

function createGroceryItem(
  name: string,
  quantity: string,
  category: GroceryCategory,
  ingredient: RecipeIngredient,
  shoppingNote?: string,
): GroceryListItem {
  const pantryStaple = ingredient.pantryItem || quantity === 'pantry check' || category === 'Spices';

  return {
    category,
    name,
    pantryItem: pantryStaple,
    pantryStaple,
    quantity,
    shoppingNote,
    sourceIngredient: formatSourceIngredient(ingredient),
  };
}

function ensureCoreGroceryItems(
  items: GroceryListItem[],
  dishText: string,
) {
  const result = [...items];

  if (dishText.includes('burger')) {
    addGroceryItemIfMissing(result, ['bun'], {
      category: 'Bakery / Bread',
      name: 'burger buns',
      quantity: '1 pack',
    });
    addGroceryItemIfMissing(result, ['beef', 'turkey', 'patty', 'patties'], {
      category: 'Protein',
      name: 'ground beef or turkey',
      quantity: '8 oz or 2 patties',
    });
    if (dishText.includes('cheese') || dishText.includes('cheeseburger')) {
      addGroceryItemIfMissing(result, ['cheese', 'cheddar', 'american'], {
        category: 'Dairy',
        name: 'sliced cheddar or American cheese',
        quantity: '2 slices or 1 small pack',
      });
    }
    addGroceryItemIfMissing(result, ['tomato'], {
      category: 'Produce',
      name: 'tomato',
      quantity: '1',
    });
    addGroceryItemIfMissing(result, ['lettuce', 'romaine'], {
      category: 'Produce',
      name: 'romaine or lettuce',
      quantity: '1 small head or 1 bag',
    });
    addGroceryItemIfMissing(result, ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'sauce'], {
      category: 'Sauces / Condiments',
      name: 'mayo, ketchup, or mustard',
      quantity: '',
      shoppingNote: 'Small jar or bottle if you do not have it.',
    });
  }

  return result;
}

function addGroceryItemIfMissing(
  items: GroceryListItem[],
  keywords: string[],
  item: GroceryListItem,
) {
  const hasItem = items.some((candidate) => includesAny(candidate.name.toLowerCase(), keywords));
  if (!hasItem) {
    items.push(item);
  }
}

function dedupeGroceryItems(items: GroceryListItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.category}:${item.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getMeatShoppingQuantity(quantity: string) {
  const normalized = quantity.toLowerCase();
  if (normalized.includes('lb')) {
    return quantity;
  }
  if (normalized.includes('oz')) {
    return quantity;
  }

  return '8 oz';
}

function getGroceryCategory(ingredient: RecipeIngredient): GroceryCategory {
  const name = ingredient.name.toLowerCase();

  if (includesAny(name, ['lettuce', 'tomato', 'onion', 'pickle', 'spinach', 'kale', 'arugula', 'cucumber', 'greens', 'scallion', 'garlic'])) {
    return 'Produce';
  }
  if (includesAny(name, ['ground beef', 'patty', 'patties', 'turkey', 'beef', 'chicken', 'falafel', 'shrimp', 'tofu', 'pork'])) {
    return 'Protein';
  }
  if (includesAny(name, ['bun', 'buns', 'bread', 'roll', 'dough', 'crust', 'flatbread'])) {
    return 'Bakery / Bread';
  }
  if (includesAny(name, ['cream', 'parmesan', 'milk', 'butter', 'yogurt', 'cheddar', 'cheese', 'mozzarella'])) {
    return 'Dairy';
  }
  if (includesAny(name, ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'sauce', 'condiment', 'dressing', 'gochujang', 'soy sauce', 'harissa', 'hummus'])) {
    return 'Sauces / Condiments';
  }
  if (includesAny(name, ['pasta', 'rigatoni', 'spaghetti', 'noodle', 'noodles', 'rice', 'grain', 'quinoa'])) {
    return 'Noodles / Grains';
  }
  if (includesAny(name, ['cilantro', 'parsley', 'basil', 'sesame', 'lime', 'lemon', 'herb'])) {
    return 'Garnish';
  }
  if (includesAny(name, ['pepper', 'flakes', 'chili', 'gochugaru', 'garlic powder', 'paprika', 'salt', 'seasoning', 'spice'])) {
    return 'Spices';
  }
  if (ingredient.pantryItem || includesAny(name, ['tomato paste', 'biscuit mix', 'flour', 'sugar', 'broth', 'oil'])) {
    return 'Pantry';
  }

  return 'Pantry';
}

function formatSourceIngredient(ingredient: RecipeIngredient) {
  return `${ingredient.quantity} ${ingredient.name}`.trim();
}

function getAnalysisText(analysis: FoodImageAnalysis) {
  return [
    analysis.dishName,
    analysis.broadDishCategory,
    analysis.cuisine,
    ...getVisibleComponentValues(analysis.visibleComponents),
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getDefaultSubstitutions() {
  return ['Adjust ingredients to taste or substitute similar pantry staples.'];
}

// Strategy coherence for wrapped/filled dishes. A recipe is either shortcut
// (prepared/frozen base) or from-scratch (wrappers + raw filling + prep steps)
// — never both, and never the finished scanned dish pretending to be a raw
// ingredient ("fried wontons" in the list of a fried-wonton recipe).
const WRAPPED_DISH_RE = /\b(wonton|dumpling|gyoza|potsticker|pot sticker|mandu|spring roll|egg roll)s?\b/i;
const FINISHED_DISH_INGREDIENT_RE = /\b(?:fried|cooked|prepared|leftover)\s+(wonton|dumpling|gyoza|potsticker|spring roll|egg roll)s?\b/i;
const PREPARED_BASE_RE = /\b(?:frozen|store-?bought|pre-?made|ready-?made)\b/i;
const SCRATCH_WRAPPER_RE = /\bwrappers?\b/i;
const SCRATCH_FILLING_RE = /\bground\s+(?:pork|beef|chicken|turkey|meat)\b/i;

export function enforceDishStrategy(ingredients: RecipeIngredient[], dishText: string): RecipeIngredient[] {
  if (!WRAPPED_DISH_RE.test(dishText)) {
    return ingredients;
  }

  const isScratchComponent = (name: string) => SCRATCH_WRAPPER_RE.test(name) || SCRATCH_FILLING_RE.test(name);
  const finishedIndex = ingredients.findIndex((ingredient) => FINISHED_DISH_INGREDIENT_RE.test(ingredient.name));

  // Finished dish listed as an ingredient → this is really a shortcut recipe.
  // Rename it honestly and drop the raw from-scratch components.
  if (finishedIndex >= 0) {
    return ingredients
      .map((ingredient, index) =>
        index === finishedIndex
          ? {
              ...ingredient,
              // "frozen <base>s" keeps the downstream shortcut detection and
              // addIngredientIfMissing keywords ("frozen wonton") matching.
              name: ingredient.name.replace(
                FINISHED_DISH_INGREDIENT_RE,
                (_match, base: string) => `frozen ${base}s`,
              ),
            }
          : ingredient,
      )
      .filter((ingredient, index) => index === finishedIndex || !isScratchComponent(ingredient.name));
  }

  // Prepared base mixed with raw wrapper/filling → keep the shortcut, drop the
  // scratch components so steps and grocery list stay coherent.
  const hasPreparedBase = ingredients.some((ingredient) => PREPARED_BASE_RE.test(ingredient.name));
  const hasScratchComponents = ingredients.some((ingredient) => isScratchComponent(ingredient.name));
  if (hasPreparedBase && hasScratchComponents) {
    return ingredients.filter((ingredient) => !isScratchComponent(ingredient.name));
  }

  return ingredients;
}

function ensureCoreIngredients(
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
  mode: RecipeMode = 'Restaurant Copy',
) {
  const dishText = [
    analysis.dishName,
    analysis.broadDishCategory,
    analysis.cuisine,
    ...getVisibleComponentValues(analysis.visibleComponents),
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();
  const result = enforceDishStrategy([...ingredients], dishText);

  if (dishText.includes('burger')) {
    addIngredientIfMissing(result, ['bun', 'brioche', 'roll'], {
      name: 'burger buns',
      quantity: '2',
    });
    addIngredientIfMissing(result, ['patty', 'beef', 'turkey', 'veggie patty', 'plant-based'], {
      name: 'burger patties',
      quantity: '2',
    });
    if (dishText.includes('cheese')) {
      addIngredientIfMissing(result, ['cheese', 'cheddar', 'american'], {
        name: 'cheese slices',
        quantity: '2 slices',
      });
    }
    addIngredientIfMissing(result, ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'burger sauce', 'sauce'], {
      name: 'burger sauce or mayonnaise',
      quantity: '2 tbsp',
    });
    addIngredientIfMissing(result, ['lettuce', 'romaine'], {
      name: 'lettuce leaves',
      quantity: '2',
    });
    addIngredientIfMissing(result, ['tomato'], {
      name: 'tomato slices',
      quantity: '2',
    });
  }

  if (dishText.includes('pizza')) {
    addIngredientIfMissing(result, ['dough', 'crust', 'flatbread'], {
      name: 'pizza dough or crust',
      quantity: '1 small',
    });
    addIngredientIfMissing(result, ['sauce', 'marinara', 'tomato'], {
      name: 'pizza sauce',
      quantity: '1/3 cup',
    });
    addIngredientIfMissing(result, ['cheese', 'mozzarella'], {
      name: 'mozzarella',
      quantity: '1 cup',
    });
  }

  if (dishText.includes('noodle') || dishText.includes('pasta') || dishText.includes('rigatoni') || dishText.includes('spaghetti')) {
    addIngredientIfMissing(result, ['noodle', 'pasta', 'rigatoni', 'spaghetti'], {
      name: dishText.includes('noodle') ? 'wheat noodles' : 'pasta',
      quantity: '8 oz',
    });
    addIngredientIfMissing(result, ['sauce', 'gochujang', 'tomato paste', 'cream', 'soy sauce'], {
      name: dishText.includes('korean') || dishText.includes('gochujang') ? 'gochujang sauce base' : 'sauce base',
      quantity: '2 tbsp',
    });
    addIngredientIfMissing(result, ['garlic', 'onion', 'ginger'], {
      name: 'garlic',
      quantity: '1 clove',
      pantryItem: true,
    });
  }

  if (dishText.includes('elote') || dishText.includes('mexican street corn') || dishText.includes('esquites')) {
    addIngredientIfMissing(result, ['corn', 'ear', 'maiz'], { name: 'corn on the cob', quantity: '2 ears' });
    addIngredientIfMissing(result, ['mayo', 'mayonnaise', 'crema', 'sour cream'], { name: 'mayonnaise or crema', quantity: '1/4 cup' });
    addIngredientIfMissing(result, ['cotija', 'queso fresco', 'cheese'], { name: 'cotija cheese', quantity: '1/2 cup, crumbled' });
    addIngredientIfMissing(result, ['lime'], { name: 'lime', quantity: '1' });
    addIngredientIfMissing(result, ['chili', 'tajin', 'tajín', 'cayenne', 'powder'], {
      name: 'chili powder or tajín',
      quantity: '1 tsp',
      pantryItem: true,
    });
    addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: 'to taste', pantryItem: true });
  }

  if (dishText.includes('ramen')) {
    addIngredientIfMissing(result, ['noodle', 'ramen noodle'], { name: 'ramen noodles', quantity: '2 packs' });
    addIngredientIfMissing(result, ['broth', 'stock', 'dashi', 'tare'], { name: 'broth', quantity: '4 cups' });
    addIngredientIfMissing(result, ['soy sauce', 'miso', 'shoyu'], { name: 'soy sauce', quantity: '2 tbsp', pantryItem: true });
    addIngredientIfMissing(result, ['egg', 'eggs'], { name: 'soft-boiled egg', quantity: '2' });
    addIngredientIfMissing(result, ['onion', 'scallion', 'green onion', 'negi'], { name: 'scallions', quantity: '2' });
  }

  if (dishText.includes('taco') || dishText.includes('tacos')) {
    addIngredientIfMissing(result, ['tortilla', 'shell', 'tostada'], { name: 'corn tortillas', quantity: '8 small' });
    addIngredientIfMissing(result, [
      'beef', 'chicken', 'pork', 'fish', 'shrimp', 'carnitas', 'al pastor',
      'carne', 'barbacoa', 'chorizo', 'turkey',
    ], { name: 'ground beef', quantity: '1 lb' });
    addIngredientIfMissing(result, ['lime'], { name: 'lime', quantity: '2' });
    addIngredientIfMissing(result, ['cilantro'], { name: 'fresh cilantro', quantity: '1/4 cup' });
    addIngredientIfMissing(result, ['onion'], { name: 'white onion', quantity: '1/4, diced' });
  }

  if (dishText.includes('fried rice')) {
    addIngredientIfMissing(result, ['rice', 'jasmine', 'white rice', 'day-old'], { name: 'cooked rice', quantity: '2 cups' });
    addIngredientIfMissing(result, ['oil', 'sesame oil', 'vegetable oil', 'butter'], {
      name: 'vegetable oil',
      quantity: '2 tbsp',
      pantryItem: true,
    });
    addIngredientIfMissing(result, ['soy sauce', 'tamari', 'oyster sauce'], {
      name: 'soy sauce',
      quantity: '2 tbsp',
      pantryItem: true,
    });
    addIngredientIfMissing(result, ['egg', 'eggs'], { name: 'eggs', quantity: '2' });
    addIngredientIfMissing(result, ['garlic', 'onion', 'scallion', 'shallot'], {
      name: 'garlic',
      quantity: '2 cloves',
      pantryItem: true,
    });
  }

  if (includesAny(dishText, ['wonton', 'dumpling', 'gyoza', 'potsticker', 'pot sticker', 'mandu', 'dim sum'])) {
    // Pick ONE coherent strategy so the list never mixes "frozen dumplings" with raw filling.
    // Shortcut = frozen base (no wrapper/filling); from-scratch = wrappers + filling.
    const hasFrozen = result.some((i) => /frozen\s+dumpling|frozen\s+wonton|frozen\s+gyoza|frozen\s+potsticker/i.test(i.name));
    const hasWrapper = result.some((i) => /wrapper/i.test(i.name));
    const shortcut = hasFrozen || (mode === 'Budget' && !hasWrapper);

    if (shortcut) {
      // Replace any wrapper the model added so we don't end up half-shortcut, half-scratch.
      addIngredientIfMissing(result, ['frozen dumpling', 'frozen wonton', 'frozen gyoza', 'frozen potsticker'], {
        name: 'frozen dumplings',
        quantity: '1 lb (about 20)',
      });
    } else {
      addIngredientIfMissing(result, ['wrapper', 'wonton wrapper', 'dumpling wrapper'], {
        name: dishText.includes('wonton') ? 'wonton wrappers' : 'dumpling wrappers',
        quantity: '1 package',
      });
      addIngredientIfMissing(result, ['pork', 'beef', 'chicken', 'shrimp', 'meat', 'turkey', 'tofu'], { name: 'ground pork', quantity: '1/2 lb' });
      addIngredientIfMissing(result, ['cabbage', 'napa'], { name: 'napa cabbage', quantity: '1 cup, minced' });
      addIngredientIfMissing(result, ['white pepper'], { name: 'white pepper', quantity: '1/4 tsp', pantryItem: true });
      addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: 'to taste', pantryItem: true });
      addIngredientIfMissing(result, ['cooking oil', 'vegetable oil', 'canola'], { name: 'vegetable oil', quantity: '2 tbsp', pantryItem: true });
    }

    // Aromatics + sauce — needed for both strategies (the sauce is the dish).
    addIngredientIfMissing(result, ['ginger'], { name: 'fresh ginger', quantity: '1 tsp, grated', pantryItem: true });
    addIngredientIfMissing(result, ['garlic'], { name: 'garlic', quantity: '2 cloves', pantryItem: true });
    addIngredientIfMissing(result, ['soy sauce', 'tamari'], { name: 'soy sauce', quantity: '2 tbsp', pantryItem: true });
    addIngredientIfMissing(result, ['sesame oil'], { name: 'sesame oil', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['scallion', 'green onion', 'spring onion'], { name: 'green onions', quantity: '2 stalks' });

    // Chili oil dumplings: ensure the glossy sauce components.
    if (includesAny(dishText, ['chili oil', 'chili crisp', 'chilli oil', 'spicy', 'la-yu', 'lao gan ma'])) {
      addIngredientIfMissing(result, ['chili oil', 'chili crisp', 'chilli oil'], { name: 'chili oil', quantity: '2 tbsp' });
      addIngredientIfMissing(result, ['rice vinegar', 'black vinegar', 'vinegar'], { name: 'rice vinegar', quantity: '1 tbsp', pantryItem: true });
      addIngredientIfMissing(result, ['sesame seed'], { name: 'sesame seeds', quantity: '1 tsp', pantryItem: true });
      addIngredientIfMissing(result, ['sugar', 'honey'], { name: 'sugar', quantity: '1 tsp', pantryItem: true });
    }
  }

  if (includesAny(dishText, ['octopus', 'pulpo', 'calamari', 'squid', 'tentacle'])) {
    addIngredientIfMissing(result, ['garlic'], { name: 'garlic', quantity: '3 cloves', pantryItem: true });
    addIngredientIfMissing(result, ['olive oil', 'oil'], { name: 'olive oil', quantity: '2 tbsp', pantryItem: true });
    addIngredientIfMissing(result, ['lemon', 'lime', 'citrus'], { name: 'lemon', quantity: '1' });
    addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: 'to taste', pantryItem: true });
    addIngredientIfMissing(result, ['pepper', 'black pepper'], { name: 'black pepper', quantity: 'to taste', pantryItem: true });
    addIngredientIfMissing(result, ['paprika', 'smoked paprika', 'pimentón'], { name: 'smoked paprika', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['parsley', 'herb', 'thyme', 'oregano', 'cilantro'], { name: 'fresh parsley', quantity: '2 tbsp' });
  }

  if (includesAny(dishText, ['cream bun', 'custard bun', 'bao bun', 'milk bun', 'brioche bun', 'filled bun', 'donut', 'doughnut', 'eclair', 'cream puff', 'profiterole', 'choux', 'danish', 'mochi', 'pastry'])) {
    addIngredientIfMissing(result, ['bun', 'bao', 'roll', 'brioche', 'dough', 'bread', 'pastry shell', 'choux', 'mochi'], { name: 'store-bought soft buns or bao buns', quantity: '6' });
    addIngredientIfMissing(result, ['cream cheese', 'whipped cream', 'heavy cream', 'mascarpone', 'cream filling', 'ricotta', 'cream', 'creme', 'crème'], { name: 'cream cheese', quantity: '4 oz', pantryItem: true });
    addIngredientIfMissing(result, ['powdered sugar', 'icing sugar', 'confectioner', 'granulated sugar', 'honey', 'maple syrup'], { name: 'powdered sugar', quantity: '1/2 cup', pantryItem: true });
    addIngredientIfMissing(result, ['vanilla', 'vanilla extract', 'vanilla bean'], { name: 'vanilla extract', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['jam', 'compote', 'preserve', 'curd', 'berry', 'blueberry', 'strawberry', 'raspberry', 'mango', 'peach', 'fruit filling', 'lemon curd'], { name: 'fruit jam or compote', quantity: '1/3 cup' });
  }

  if (includesAny(dishText, ['fried fish', 'fish and chips', 'fish n chips', 'fish-shaped', 'fish fillet', 'battered fish', 'crispy fish', 'beer battered'])) {
    addIngredientIfMissing(result, ['white fish', 'cod', 'haddock', 'tilapia', 'pollock', 'catfish', 'fish', 'shark'], { name: 'white fish fillets', quantity: '1 lb' });
    addIngredientIfMissing(result, ['flour', 'all-purpose flour'], { name: 'all-purpose flour', quantity: '1 cup', pantryItem: true });
    addIngredientIfMissing(result, ['cornstarch', 'corn starch'], { name: 'cornstarch', quantity: '1/4 cup', pantryItem: true });
    addIngredientIfMissing(result, ['baking powder'], { name: 'baking powder', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['sparkling water', 'soda water', 'beer', 'cold water', 'egg'], { name: 'cold sparkling water', quantity: '3/4 cup' });
    addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['black pepper', 'pepper'], { name: 'black pepper', quantity: '1/2 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['paprika', 'smoked paprika'], { name: 'paprika', quantity: '1 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['garlic powder', 'garlic'], { name: 'garlic powder', quantity: '1/2 tsp', pantryItem: true });
    addIngredientIfMissing(result, ['oil', 'vegetable oil', 'canola oil', 'frying oil'], { name: 'vegetable oil for frying', quantity: '2 cups', pantryItem: true });
    addIngredientIfMissing(result, ['tartar sauce', 'aioli', 'remoulade', 'mayo'], { name: 'tartar sauce', quantity: '1/4 cup' });
    addIngredientIfMissing(result, ['lemon', 'lime'], { name: 'lemon', quantity: '1' });
    addIngredientIfMissing(result, ['fries', 'french fries', 'potato', 'chips'], { name: 'frozen fries', quantity: '1 lb' });
  }

  if (isMangoStickyRiceDish(dishText)) {
    addIngredientIfMissing(result, ['sticky rice', 'glutinous rice', 'sweet rice'], {
      name: 'sticky rice (glutinous)',
      quantity: '1 cup uncooked',
    });
    addIngredientIfMissing(result, ['mango', 'mangoes', 'ripe mango', 'ripe mangoes', 'sliced mango', 'diced mango'], {
      name: 'ripe mangoes',
      quantity: '2',
    });
    // Prefer coconut milk; block coconut cream from being added separately.
    if (!result.some((i) => /coconut (milk|cream)/i.test(i.name))) {
      result.push({ name: 'coconut milk', quantity: '1 can (400ml)', pantryItem: false });
    }
    addIngredientIfMissing(result, ['sugar', 'palm sugar', 'granulated sugar', 'white sugar'], {
      name: 'sugar',
      quantity: '3 tbsp',
      pantryItem: true,
    });
    addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: '1/2 tsp', pantryItem: true });
  }

  if (includesAny(dishText, ['musubi', 'spam musubi'])) {
    addIngredientIfMissing(result, ['spam', 'luncheon meat', 'canned pork', 'canned meat'], {
      name: 'Spam (canned)',
      quantity: '1 can',
    });
    addIngredientIfMissing(result, ['sushi rice', 'japanese rice', 'short grain rice', 'sticky rice', 'rice'], {
      name: 'sushi rice',
      quantity: '1 cup uncooked',
    });
    addIngredientIfMissing(result, ['nori', 'seaweed', 'dried seaweed'], {
      name: 'nori sheets',
      quantity: '2 full sheets',
    });
    addIngredientIfMissing(result, ['soy sauce', 'tamari'], {
      name: 'soy sauce',
      quantity: '2 tbsp',
      pantryItem: true,
    });
    addIngredientIfMissing(result, ['sugar', 'honey', 'mirin'], {
      name: 'sugar',
      quantity: '1 tbsp',
      pantryItem: true,
    });
    // Prefer "seasoned rice vinegar" (1 ingredient) over the 3-ingredient breakdown.
    if (!result.some((i) => /seasoned rice vinegar/i.test(i.name))) {
      addIngredientIfMissing(result, ['rice vinegar', 'vinegar', 'mirin'], {
        name: 'rice vinegar',
        quantity: '1 tbsp',
        pantryItem: true,
      });
    }
    addIngredientIfMissing(result, ['salt'], { name: 'salt', quantity: '1/2 tsp', pantryItem: true });
  }

  if (dishText.includes('salad') && !dishText.includes('pasta salad') && !dishText.includes('potato salad')) {
    addIngredientIfMissing(result, [
      'lettuce', 'romaine', 'spinach', 'arugula', 'kale', 'mixed greens', 'mesclun', 'radicchio',
    ], { name: 'salad greens', quantity: '4 cups' });
    addIngredientIfMissing(result, ['dressing', 'vinaigrette', 'ranch', 'caesar', 'tahini'], {
      name: 'salad dressing',
      quantity: '2 tbsp',
    });
  }

  return result;
}


function addIngredientIfMissing(
  ingredients: RecipeIngredient[],
  keywords: string[],
  ingredient: RecipeIngredient,
) {
  const hasIngredient = ingredients.some((candidate) => (
    keywords.some((keyword) => candidate.name.toLowerCase().includes(keyword))
  ));

  if (!hasIngredient) {
    ingredients.push(ingredient);
  }
}

function getSpicePairings(values: string[], analysis: FoodImageAnalysis) {
  const fallback = getDefaultSpicePairings(analysis);
  return getSafeList(values, fallback, 3)
    .map(cleanRecipeCopy)
    .filter((value) => value.length > 0);
}

function getDefaultSpicePairings(analysis: FoodImageAnalysis) {
  const text = [
    analysis.broadDishCategory,
    analysis.cuisine,
    analysis.dishName,
    ...getVisibleComponentValues(analysis.visibleComponents),
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();

  if (isDrinkAnalysisText(text)) {
    return ['cinnamon', 'vanilla', 'honey'];
  }
  if (text.includes('korean') || text.includes('gochujang') || text.includes('noodle')) {
    return ['gochugaru', 'toasted sesame oil', 'scallions', 'rice vinegar'];
  }
  if (text.includes('pasta') || text.includes('rigatoni') || text.includes('tomato')) {
    return ['red pepper flakes', 'basil', 'parmesan', 'black pepper'];
  }
  if (text.includes('bowl') || text.includes('grain') || text.includes('mediterranean')) {
    return ['lemon', 'sumac', 'parsley', 'harissa'];
  }
  if (text.includes('chicken')) {
    return ['garlic', 'paprika', 'lemon', 'fresh herbs'];
  }

  return ['garlic', 'black pepper', 'fresh herbs', 'chili flakes'];
}

function getCookingTerms(values: OpenRouterRecipeVariant['cookingTerms'], steps: string[]): CookingTerm[] {
  const cleanTerms = (Array.isArray(values) ? values : [])
    .map((value) => ({
      term: cleanRecipeCopy(getShortText(value.term, '', 32)),
      meaning: cleanRecipeCopy(getShortText(value.meaning, '', 90)),
    }))
    .filter((value) => value.term && value.meaning);

  const fallbackTerms = getDefaultCookingTerms(steps);
  const merged = [...cleanTerms, ...fallbackTerms];
  const seenTerms = new Set<string>();

  return merged.filter((value) => {
    const key = value.term.toLowerCase();
    if (seenTerms.has(key)) {
      return false;
    }
    seenTerms.add(key);
    return true;
  }).slice(0, 3);
}

function getDefaultCookingTerms(steps: string[]): CookingTerm[] {
  const stepText = steps.join(' ').toLowerCase();
  const terms: CookingTerm[] = [];

  if (stepText.includes('simmer')) {
    terms.push({ term: 'Simmer', meaning: 'Cook gently with small bubbles.' });
  }
  if (stepText.includes('bloom')) {
    terms.push({ term: 'Bloom', meaning: 'Warm spices or paste in oil to deepen flavor.' });
  }
  if (stepText.includes('al dente')) {
    terms.push({ term: 'Al dente', meaning: 'Tender pasta with a slight bite.' });
  }
  if (stepText.includes('fold')) {
    terms.push({ term: 'Fold', meaning: 'Gently combine without mashing or overmixing.' });
  }

  return terms.length > 0 ? terms : [
    { term: 'Season as you go', meaning: 'Start with 1/4 teaspoon salt, taste, then add more in small pinches until it tastes right.' },
  ];
}

function normalizeDifficulty(value: string): Difficulty {
  const normalized = value.toLowerCase();
  if (normalized.includes('hard')) {
    return 'Hard';
  }
  if (normalized.includes('medium')) {
    return 'Medium';
  }

  return 'Easy';
}

function parseMinutes(value: string, fallback: number) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function parseServings(value: unknown, fallback: number) {
  const parsed = getFiniteNumber(value);
  if (parsed === undefined) {
    return fallback;
  }

  return Math.round(clampNumber(parsed, 1, 12));
}

function toRecipeIngredient(value: string): RecipeIngredient {
  const cleaned = cleanRecipeCopy(getShortText(value, 'ingredient', 80))
    .replace(/\s+/g, ' ')
    .trim();
  const withoutBadAsNeeded = cleaned.replace(/^(?:as needed\s+)+/i, '').trim();
  const toTasteMatch = withoutBadAsNeeded.match(/^(.+?)\s+(?:to taste)$/i);
  if (toTasteMatch && canUseToTaste(toTasteMatch[1])) {
    return {
      name: cleanIngredientName(toTasteMatch[1]),
      quantity: 'to taste',
      pantryItem: isPantryIngredient(toTasteMatch[1]),
    };
  }

  const quantityMatch = withoutBadAsNeeded.match(/^((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|one|two|three|four|five|six|a|an)\s*(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|ml|clove|cloves|slice|slices|can|cans|bunch|bunches|stalk|stalks|piece|pieces|package|packages|bottle|bottles|jar|jars|bag|bags|box|boxes|large|medium|small)?)\s+(.+)$/i);
  if (quantityMatch) {
    const name = cleanIngredientName(quantityMatch[2]);
    return {
      name,
      quantity: normalizeQuantity(quantityMatch[1]),
      pantryItem: isPantryIngredient(name),
    };
  }

  const name = cleanIngredientName(withoutBadAsNeeded);
  return {
    name,
    quantity: getFallbackQuantity(name),
    pantryItem: isPantryIngredient(name),
  };
}

// Dish names the AI uses as ingredients → the actual grocery item to buy.
const DISH_NAME_TRANSLATIONS: Record<string, string> = {
  'elote': 'corn on the cob',
  'elotes': 'corn on the cob',
  'esquites': 'corn kernels',
};

function cleanIngredientName(value: string) {
  const cleaned = cleanRecipeCopy(value)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*,?\s*(?:to taste|as needed)$/i, '')
    // Fix "2 slices of tomato" → quantity parsed, name left as "of tomato"
    .replace(/^of\s+/i, '')
    // Strip decorative words that never affect what to buy
    .replace(/\b(?:cute|bunny-?shaped|instagram-?style|restaurant-?style|premium|fancy|signature)\b\s*/gi, '')
    // Strip trailing serving/presentation words when the food name remains complete
    // e.g. "lime wedge" → "lime", "cilantro sprig" → "cilantro"
    .replace(/\s+(?:wedges?|sprigs?)$/i, '')
    // Fix malformed nori names: "sheets nori strips" → "nori sheets"
    .replace(/^sheets?\s+nori\s+strips?\b/i, 'nori sheets')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return DISH_NAME_TRANSLATIONS[cleaned] ?? cleaned;
}

function normalizeQuantity(value: string) {
  return value
    .replace(/\btablespoons?\b/gi, 'tbsp')
    .replace(/\bteaspoons?\b/gi, 'tsp')
    .replace(/\bounces?\b/gi, 'oz')
    .replace(/\bpounds?\b/gi, 'lb')
    .replace(/\bgrams?\b/gi, 'g')
    .replace(/\bone\b/i, '1')
    .replace(/\btwo\b/i, '2')
    .replace(/\bthree\b/i, '3')
    .replace(/\bfour\b/i, '4')
    .replace(/\bfive\b/i, '5')
    .replace(/\bsix\b/i, '6')
    .replace(/\ban?\b/i, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFallbackQuantity(name: string) {
  const normalized = name.toLowerCase();

  if (canUseToTaste(normalized)) {
    return 'to taste';
  }
  if (normalized.includes('noodle') || normalized.includes('pasta') || normalized.includes('rice')) {
    return '8 oz';
  }
  if (normalized.includes('garlic')) {
    return '1 clove';
  }
  if (normalized.includes('ginger') || normalized.includes('gochujang') || normalized.includes('tomato paste')) {
    return '1 tbsp';
  }
  if (normalized.includes('soy sauce') || normalized.includes('vinegar') || normalized.includes('sesame oil')) {
    return '2 tsp';
  }
  if (normalized.includes('oil') || normalized.includes('butter')) {
    return '1 tbsp';
  }
  if (normalized.includes('mayonnaise') || normalized.includes('mayo') || normalized.includes('ketchup') || normalized.includes('mustard')) {
    return '2 tbsp';
  }
  if (normalized.includes('bun')) {
    return '2';
  }
  if (normalized.includes('patty') || normalized.includes('burger')) {
    return '2';
  }
  if (normalized.includes('sauce') || normalized.includes('broth') || normalized.includes('cream')) {
    return '1/2 cup';
  }
  if (normalized.includes('cheese slice')) {
    return '2 slices';
  }
  if (normalized.includes('tomato')) {
    return '2 slices';
  }
  if (normalized.includes('lettuce') || normalized.includes('romaine')) {
    return '2 leaves';
  }
  if (normalized.includes('cheese') || normalized.includes('parmesan')) {
    return '1/4 cup';
  }
  if (normalized.includes('egg')) {
    return '1';
  }
  if (normalized.includes('chicken') || normalized.includes('beef') || normalized.includes('pork') || normalized.includes('tofu')) {
    return '8 oz';
  }
  if (normalized.includes('scallion') || normalized.includes('green onion')) {
    return '2';
  }

  return '1 cup';
}

function canUseToTaste(value: string) {
  const normalized = value.toLowerCase();
  return [
    'salt',
    'pepper',
    'spice',
    'chili',
    'gochugaru',
    'garnish',
    'herb',
    'lime',
    'lemon',
  ].some((keyword) => normalized.includes(keyword));
}

function isPantryIngredient(value: string) {
  const normalized = value.toLowerCase();
  return [
    'salt',
    'pepper',
    'oil',
    'spice',
    'chili',
    'garlic',
    'soy sauce',
    'vinegar',
    'sugar',
  ].some((keyword) => normalized.includes(keyword));
}

// Prompt-injection phrasing that should never surface as recipe copy, even if
// the model echoes it back. Matched loosely (case-insensitive substrings).
const promptInjectionPhrases = [
  /ignore (?:all )?(?:previous|prior|above) instructions/gi,
  /disregard (?:all )?(?:previous|prior|above) instructions/gi,
  /you are now/gi,
  /system prompt/gi,
  /as an ai (?:language model|assistant)/gi,
];

function cleanRecipeCopy(value: string) {
  return value
    .replace(/<[^>]*>/g, '') // strip HTML/markup tags
    .replace(/\bhttps?:\/\/\S+/gi, '') // strip URLs
    .replace(/\bwww\.\S+/gi, '') // strip bare www. URLs
    .replace(promptInjectionPhrases[0], '')
    .replace(promptInjectionPhrases[1], '')
    .replace(promptInjectionPhrases[2], '')
    .replace(promptInjectionPhrases[3], '')
    .replace(promptInjectionPhrases[4], '')
    .replace(/\bcipycat\b/gi, 'inspired-by')
    .replace(/\bcopy\s*cat\b/gi, 'inspired-by')
    .replace(/\bcopycat(?:-style)?\b/gi, 'inspired-by')
    .replace(/\bofficial\b/gi, 'restaurant-style')
    .replace(/\s+/g, ' ')
    .trim();
}

// Log-only heuristic: flags recipe steps that read as unsafe cooking advice
// (undercooked meat/eggs, sealed-container microwave instructions) so we have
// visibility into how often the model produces this. Does not block or alter
// the recipe — food-safety UX gating is a separate, larger decision.
const unsafeCookingPatterns = [
  /raw chicken/gi,
  /undercooked (?:chicken|pork|meat|poultry)/gi,
  /rare (?:chicken|pork)/gi,
  /raw (?:egg|eggs)(?! plant)/gi,
  /seal(?:ed)? (?:container|bag|jar).{0,30}microwave/gi,
  /microwave.{0,30}seal(?:ed)? (?:container|bag|jar)/gi,
];

function logUnsafeCookingHeuristic(recipeId: string, steps: string[]) {
  const joined = steps.join(' \n ');
  const matches = unsafeCookingPatterns
    .map((pattern) => joined.match(pattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .flat();

  if (matches.length > 0) {
    console.warn('[food_safety_heuristic]', { recipeId, matchCount: matches.length, samples: matches.slice(0, 3) });
  }
}

function ensureInspiredTitle(value: string) {
  // Strip "Inspired-by" / "Inspired by" variants — the UI badge handles that copy, not the title.
  // Also strip leading "Homemade" and normalize shark → fish (common hallucination on novelty foods).
  return cleanRecipeCopy(value)
    .replace(/^homemade\s+/i, '')
    .replace(/\bshark\b/gi, 'fish')
    .replace(/\s*[-–]\s*inspired[\s-]?by\b/gi, '')
    .replace(/\s+inspired[\s-]?by\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureInspiredCopy(value: string) {
  return cleanRecipeCopy(value);
}

function getSafeList(values: string[] | undefined, fallback: string[], maxItems: number) {
  const cleanValues = (Array.isArray(values) ? values : [])
    .map((value) => getShortText(value, '', 120))
    .filter((value) => Boolean(value) && !isPlaceholderText(value));
  const source = cleanValues.length > 0 ? cleanValues : fallback;

  return [...new Set(source)].slice(0, maxItems);
}

// Catches prompt-echo junk like "...", "...x6", or symbol-only strings so it
// never reaches the app as a recipe title, step, or ingredient.
function isPlaceholderText(value: string) {
  const letterCount = (value.match(/[a-zA-Z]/g) ?? []).length;
  return /\.{3}|…/.test(value) || letterCount < 3;
}

function getSafeTextValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getShortText(value: unknown, fallback: string, maxLength: number) {
  const text = getSafeTextValue(value, fallback);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}.` : text;
}

function getOptionalShortText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim() ? getShortText(value, value, maxLength) : undefined;
}

function getOneSentence(value: unknown, fallback: string) {
  const text = getSafeTextValue(value, fallback);
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return getShortText(match?.[0] ?? text, fallback, 180);
}

function getFiniteNumber(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Derives a short 2-word title from an instruction string for compact-retry steps that arrive
// as plain strings (no AI-generated title field). Picks the first two non-article words.
function deriveTitleFromInstruction(text: string): string {
  const SKIP = new Set(['a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'of', 'up', 'with', 'then', 'into', 'your', 'both', 'until', 'all', 'its', 'by', 'for', 'from']);
  const words = text.replace(/[.,!?;:]+/g, ' ').split(/\s+/).slice(0, 12);
  const key = words
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 1 && !SKIP.has(w.toLowerCase()))
    .slice(0, 2);
  return key.map(titleCase).join(' ');
}

function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  const ta = tokenize(a);
  const tb = tokenize(b);
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 ? intersection / union : 0;
}

export type CoachingWarning = { tag: string; ctx: object };
export type CoachingWarningResult = {
  score: number;
  totalWarnings: number;
  warnCounts: Record<string, number>;
  warnings: CoachingWarning[];
};

// Pure detection pass: scans steps and returns every coaching-quality warning,
// the per-tag counts, and the recipe's coaching score. No console output — the
// caller decides whether to log (dev visibility) or persist (analytics), so the
// same detection feeds both the audit logger and the analytics layer.
function collectCoachingWarnings(
  steps: RecipeStep[],
  analysis: FoodImageAnalysis,
  dishName: string,
  recipeIngredients?: string[],
  ingredientDetails?: Array<{ name: string; quantity?: string }>,
): CoachingWarningResult {
  const warnCounts: Record<string, number> = {};
  const warnings: CoachingWarning[] = [];
  const warn = (tag: string, ctx: object): void => {
    warnings.push({ tag, ctx });
    warnCounts[tag] = (warnCounts[tag] ?? 0) + 1;
  };

  const GENERIC_LOOK_FOR_PATTERNS = [
    'the food looks',
    'the dish is',
    'the mixture is',
    'everything is',
    'it is ready',
    'they are ready',
    'looks ready',
    'looks done',
    'the protein',
    'the vegetables',
    'watch for color',
    'it should look done',
    'cook until done',
  ];

  const GENERIC_CHEF_TIP_PHRASES = [
    'stir occasionally',
    'cook evenly',
    "don't overcook",
    'dont overcook',
    'season well',
    'follow instructions',
    'adjust as needed',
    'watch carefully',
    'cook thoroughly',
    'watch the heat',
    'use fresh ingredients',
    'cook carefully',
  ];

  const GENERIC_WHY_PATTERNS = [
    /\bthis (step|process) is important\b/,
    /\bthis (ensures?|helps?|creates?|makes?)\b.{0,20}\b(better|best|good|great|properly|well)\b/,
    /\bimportant for the (final |overall )?(dish|recipe|result|outcome)\b/,
    /\bproper technique\b/,
    /\bkey step\b/,
    /\bcome together\b/,
    /\boverall (dish|recipe|flavor)\b/,
    /^this step (matters|is essential|is key)/,
  ];

  const GENERIC_MISTAKE_PATTERNS = [
    /\bdon'?t mess this up\b/,
    /\bbe careful\b(?! ?not to| of (the|your|how))/,
    /\bwatch closely\b/,
    /\bpay attention\b(?! to (the temperature|the color|whether|how|if))/,
    /\bmake sure to (follow|do it|try)\b/,
  ];

  const GENERIC_QUESTION_PATTERNS = [
    'what should i do',
    'what do i do',
    'can i make this differently',
    'is this normal',
    'is this okay',
    'what now',
    'am i done',
  ];

  const COOKING_TECHNIQUE_WORDS = new Set([
    'crust', 'browning', 'searing', 'caramelization', 'caramelize', 'deglazing', 'deglaze',
    'emulsion', 'resting', 'reduction', 'reduce', 'simmering', 'rendering', 'render',
    'maillard', 'braising', 'sweating', 'blanching', 'folding', 'marinating',
    'basting', 'glazing', 'tempering', 'blooming', 'toasting',
  ]);

  const PHASE_SERVING_VERBS = /\b(serve|plate|present)\b/;

  const ingredientWords = new Set(
    [...analysis.visibleIngredients, ...analysis.likelyIngredients, ...dishName.split(/\s+/)]
      .flatMap((w) => w.toLowerCase().split(/\s+/))
      .filter((w) => w.length >= 3),
  );

  const phasesWithQuestion = new Set<number>();
  const phasesWithDecisionPoint = new Set<number>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const ctx = { dish: dishName, step: i + 1, label: step.title ?? step.text.slice(0, 40) };

    // B1 — ingredientsUsed
    if (!step.ingredientsUsed || step.ingredientsUsed.length === 0) {
      warn('[recipe-quality] missing ingredientsUsed', ctx);
    }

    // B2 — toolsUsed
    if (!step.toolsUsed || step.toolsUsed.length === 0) {
      warn('[recipe-quality] missing toolsUsed', ctx);
    }

    // lookFor — missing entirely
    if (!step.lookFor) {
      warn('[recipe-quality] missing lookFor', ctx);
    }

    const stepTextLower = `${step.title ?? ''} ${step.text}`.toLowerCase();
    const isCookingStep = step.phase === 3 || PHASE_COOKING_VERBS_RE.test(stepTextLower);

    // doneWhen — missing on cooking steps (Phase 3 or contains cooking verbs)
    if (!step.doneWhen && isCookingStep) {
      warn('[recipe-quality] missing doneWhen on cooking step', ctx);
    }

    // commonQuestion without answer — renders as an unanswered question in UI
    if (step.commonQuestion && !step.commonQuestionAnswer) {
      warn('[recipe-quality] orphaned commonQuestion', ctx);
    }

    // chefTip — missing or too short
    if (!step.chefTip) {
      warn('[recipe-quality] missing chefTip', ctx);
    } else if (step.chefTip.length < 20) {
      warn('[recipe-quality] short chefTip', { ...ctx, chefTip: step.chefTip });
    } else {
      const tipLower = step.chefTip.toLowerCase();
      if (GENERIC_CHEF_TIP_PHRASES.some((p) => tipLower.includes(p))) {
        warn('[recipe-quality] generic chefTip', { ...ctx, chefTip: step.chefTip });
      }
      if (ingredientWords.size > 0) {
        const hasIngredientRef = [...ingredientWords].some((w) => tipLower.includes(w));
        const hasTechniqueRef = [...COOKING_TECHNIQUE_WORDS].some((t) => tipLower.includes(t));
        if (!hasIngredientRef && !hasTechniqueRef) {
          warn('[recipe-quality] chefTip missing ingredient reference', { ...ctx, chefTip: step.chefTip });
        }
      }
    }

    // lookFor — generic, or has text but no observable signal (color/texture/
    // temperature/physical test). Uses the shared detector so temperature counts.
    if (step.lookFor) {
      const lower = step.lookFor.toLowerCase();
      if (GENERIC_LOOK_FOR_PATTERNS.some((p) => lower.includes(p))) {
        warn('[recipe-quality] generic lookFor', { ...ctx, lookFor: step.lookFor });
      } else if (!hasObservableSignal(step.lookFor)) {
        warn('[recipe-quality] non-visual lookFor', { ...ctx, lookFor: step.lookFor });
      }
    }

    // doneWhen — on a cooking step, a bare timer is not a completion signal.
    // Passive steps (rest/chill/marinate) may rely on time, so only cooking
    // steps are warned. Shared detector keeps this consistent with scoring.
    if (step.doneWhen && isCookingStep && !hasObservableSignal(step.doneWhen)) {
      warn('[recipe-quality] non-observable doneWhen', { ...ctx, doneWhen: step.doneWhen });
    }

    // lookFor vs doneWhen — duplicate (0.45 threshold catches moderate overlap)
    if (step.lookFor && step.doneWhen) {
      const sim = tokenSimilarity(step.lookFor, step.doneWhen);
      if (sim > 0.45) {
        warn('[recipe-quality] duplicate lookFor and doneWhen', { ...ctx, similarity: sim.toFixed(2) });
      }
    }

    // stepImagePrompt — too weak for image generation
    if (step.stepImagePrompt) {
      const words = step.stepImagePrompt.trim().split(/\s+/);
      const promptLower = step.stepImagePrompt.toLowerCase();
      const hasFood = ingredientWords.size > 0
        ? [...ingredientWords].some((w) => promptLower.includes(w))
        : /\b(chicken|beef|pork|lamb|duck|pasta|rice|sauce|bread|egg|fish|salmon|shrimp|tofu|garlic|onion|butter|oil|cream|cheese|tomato|potato|noodle|lentil|tempeh|quinoa|avocado|mushroom|cauliflower|eggplant|zucchini|coconut|tahini|edamame|mango|seafood|falafel|halloumi)\b/.test(promptLower);
      const hasAction = /\b(searing|frying|boiling|roasting|baking|simmering|chopping|mixing|grilling|plating|garnishing|cooking|slicing|stirring|browning|drizzling|seared|fried|roasted|baked|sliced|arranged|plated|reduced|marinated|softened|translucent|golden|crispy|sizzling)\b/.test(promptLower);
      const requiresAction = !step.phase || step.phase >= 3;
      if (words.length < 6 || !hasFood || (requiresAction && !hasAction)) {
        warn('[recipe-quality] weak stepImagePrompt', { ...ctx, wordCount: words.length, hasFood, hasAction, phase: step.phase });
      }
    }

    // phase — suspicious assignment
    if (step.phase !== undefined) {
      const cookingInPrepPhase = step.phase === 1 && PHASE_COOKING_VERBS_RE.test(stepTextLower);
      const servingInEarlyPhase = step.phase <= 2 && PHASE_SERVING_VERBS.test(stepTextLower);
      const cookingInServingPhase = step.phase === 6 && PHASE_COOKING_VERBS_RE.test(stepTextLower);
      if (cookingInPrepPhase || servingInEarlyPhase || cookingInServingPhase) {
        warn('[recipe-quality] suspicious phase assignment', { ...ctx, phase: step.phase });
      }
    }

    // title — missing or placeholder
    if (!step.title || !step.title.trim()) {
      warn('[recipe-quality] missing title', ctx);
    } else {
      const titleLower = step.title.toLowerCase().trim();
      const SUSPICIOUS_TITLE_PATTERNS = [
        /^step\s*\d+$/,
        /^cook(ing)?$/,
        /^prepare?(\s+ingredients?)?$/,
        /^food\s+prep$/,
        /^make\s+(the\s+)?(sauce|dish|meal|food|recipe)$/,
        /^the\s+(sauce|protein|vegetables?|dish|meal|food|ingredients?)$/,
      ];
      if (SUSPICIOUS_TITLE_PATTERNS.some((p) => p.test(titleLower))) {
        warn('[recipe-quality] suspicious title', { ...ctx, title: step.title });
      }
    }

    // why — missing or generic
    if (!step.why && !step.whyItMatters) {
      warn('[recipe-quality] missing why', ctx);
    } else {
      const whyText = (step.why ?? step.whyItMatters ?? '').toLowerCase();
      if (GENERIC_WHY_PATTERNS.some((p) => p.test(whyText))) {
        warn('[recipe-quality] generic why', { ...ctx, why: step.why ?? step.whyItMatters });
      }
    }

    // commonMistake — missing on cooking steps; generic when present
    if (!step.commonMistake && !step.safetyNote && isCookingStep) {
      warn('[recipe-quality] missing commonMistake on cooking step', ctx);
    } else if (step.commonMistake) {
      if (GENERIC_MISTAKE_PATTERNS.some((p) => p.test(step.commonMistake!.toLowerCase()))) {
        warn('[recipe-quality] generic commonMistake', { ...ctx, commonMistake: step.commonMistake });
      }
    }

    // commonQuestion — filler or too vague
    if (step.commonQuestion) {
      const questionLower = step.commonQuestion.toLowerCase();
      const isTooShort = step.commonQuestion.trim().split(/\s+/).length < 6;
      const isGeneric = GENERIC_QUESTION_PATTERNS.some((p) => questionLower.includes(p));
      if (isTooShort || isGeneric) {
        warn('[recipe-quality] generic commonQuestion', { ...ctx, question: step.commonQuestion });
      }
      if (step.phase !== undefined) {
        phasesWithQuestion.add(step.phase);
      }
    }

    // decisionPoint — track phase coverage; warn on incomplete branches
    if (step.decisionPoint) {
      if (!step.ifYes || !step.ifNo) {
        warn('[recipe-quality] incomplete decisionPoint', { ...ctx, hasIfYes: Boolean(step.ifYes), hasIfNo: Boolean(step.ifNo) });
      }
      if (step.phase !== undefined) {
        phasesWithDecisionPoint.add(step.phase);
      }
    }

    // ingredient alias audit — step references ingredient not found in recipe
    if (recipeIngredients && recipeIngredients.length > 0 && step.ingredientsUsed) {
      for (const stepIng of step.ingredientsUsed) {
        if (!recipeIngredients.some((ri) => ingredientsMatch(ri, stepIng))) {
          warn('[recipe-quality] unknown ingredient reference', { ...ctx, ingredient: stepIng });
        }
      }
    }
  }

  // Strategy coherence — the finished scanned dish must never appear as an
  // ingredient ("fried wontons" inside a fried-wonton recipe).
  if (recipeIngredients) {
    for (const ingredientName of recipeIngredients) {
      if (FINISHED_DISH_INGREDIENT_RE.test(ingredientName)) {
        warn('[recipe-quality] finished dish listed as ingredient', { dish: dishName, ingredient: ingredientName });
      }
    }
  }

  // Quantity contradiction — the classic failure is frying oil: "2 tbsp" in the
  // ingredient list while a step says "heat 2 cups of oil". Compare the unit
  // class (spoon vs cup) between the listed oil and any oil amount in steps.
  if (ingredientDetails) {
    const oilIngredient = ingredientDetails.find(
      (item) => /\boil\b/i.test(item.name) && item.quantity,
    );
    const oilUnitClass = oilIngredient?.quantity && /\b(tbsp|tsp|tablespoons?|teaspoons?)\b/i.test(oilIngredient.quantity)
      ? 'spoon'
      : oilIngredient?.quantity && /\bcups?\b/i.test(oilIngredient.quantity)
        ? 'cup'
        : null;
    if (oilUnitClass) {
      for (const step of steps) {
        const stepOil = /(\d+(?:\/\d+)?)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?)\s+(?:of\s+)?[a-z ]*\boil\b/i.exec(step.text ?? '');
        if (!stepOil) {
          continue;
        }
        const stepUnitClass = /cups?/i.test(stepOil[2]) ? 'cup' : 'spoon';
        if (stepUnitClass !== oilUnitClass) {
          warn('[recipe-quality] oil quantity contradiction', {
            dish: dishName,
            listed: oilIngredient?.quantity,
            step: stepOil[0],
          });
        }
      }
    }
  }

  // Per-phase coverage — phases 3 (Cooking), 4 (Assembly), 5 (Finishing)
  for (const requiredPhase of [3, 4, 5]) {
    const hasPhaseSteps = steps.some((s) => s.phase === requiredPhase);
    if (hasPhaseSteps) {
      if (!phasesWithQuestion.has(requiredPhase)) {
        warn('[recipe-quality] no commonQuestion in phase', { dish: dishName, phase: requiredPhase });
      }
      if (!phasesWithDecisionPoint.has(requiredPhase)) {
        warn('[recipe-quality] no decisionPoint in phase', { dish: dishName, phase: requiredPhase });
      }
    }
  }

  const coachingScore = calculateRecipeCoachingScore(steps);
  const totalWarnings = Object.values(warnCounts).reduce((a, b) => a + b, 0);
  return { score: coachingScore, totalWarnings, warnCounts, warnings };
}

// Thin logging wrapper around collectCoachingWarnings — preserves the original
// dev-console behavior (per-warning lines + a formatted recipe-quality summary)
// and returns the detection result so callers can reuse it without re-scanning.
function auditStepCoachingQuality(
  steps: RecipeStep[],
  analysis: FoodImageAnalysis,
  dishName: string,
  recipeIngredients?: string[],
  ingredientDetails?: Array<{ name: string; quantity?: string }>,
): CoachingWarningResult {
  const result = collectCoachingWarnings(steps, analysis, dishName, recipeIngredients, ingredientDetails);
  for (const { tag, ctx } of result.warnings) {
    console.warn(tag, ctx);
  }
  const summaryLines = [
    `[recipe-quality] Recipe Quality Summary — ${dishName}`,
    `  Score: ${result.score}/100 (${steps.length} steps)`,
  ];
  if (result.totalWarnings > 0) {
    summaryLines.push(`  Warnings (${result.totalWarnings} total):`);
    for (const [tag, count] of Object.entries(result.warnCounts).sort((a, b) => b[1] - a[1])) {
      summaryLines.push(`    ${tag.replace('[recipe-quality] ', '')} (${count})`);
    }
  } else {
    summaryLines.push(`  No warnings — recipe is fully coached.`);
  }
  console.log(summaryLines.join('\n'));
  return result;
}

function getDifficultyFromConfidence(confidence: number): Difficulty {
  if (confidence < 0.35) {
    return 'Medium';
  }

  return 'Easy';
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
}

function canUseOpenRouter(config: ReturnType<typeof getAiConfig>) {
  return config.enabled && config.provider === 'openrouter' && Boolean(config.openRouterApiKey);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}

function getMatchScoreFromConfidence(confidence: number) {
  return Math.max(3, Math.min(9.5, Number((confidence * 10).toFixed(1))));
}

function logFinalScanResult(result: AiScanSuccessResult) {
  const hasFoodEvidence = hasScanFoodEvidence(result.scan, result.recipe);
  logScanDebug('api_scan_final_dish_name', {
    dishName: result.scan.dishName,
  });
  logScanDebug('api_scan_final_has_recipe', {
    hasRecipe: Boolean(result.recipe),
  });
  logScanDebug('api_scan_final_has_food_evidence', { hasFoodEvidence });
  logScanDebug('api_scan_final_status', { status: 'success' });
  logScanDebug('api_scan_final_response', {
    status: 'success',
    scanState: result.scan.scanState,
    dishName: result.scan.dishName,
    hasRecipe: Boolean(result.recipe),
    hasFoodEvidence,
    fallbackReason: result.fallbackReason,
    uploadedImage: result.uploadedImage,
  });
}

function getVisibleComponentsCount(components: FoodImageAnalysis['visibleComponents']) {
  return Object.values(components).filter((value) => value.trim().length > 0).length;
}

function hasScanFoodEvidence(scan: ScanResult, recipe: Recipe | undefined) {
  return Boolean(
    isFoodScanState(scan.scanState ?? 'not_food') ||
    scan.dishName.trim().length > 0 ||
    scan.bestGuessDishName?.trim() ||
    recipe
  );
}

function getImageUriKind(image: ScanImageMetadata | undefined) {
  if (image?.dataUrl?.startsWith('data:image/')) {
    return 'data_url';
  }
  if (image?.uri?.startsWith('https://') || image?.uri?.startsWith('http://')) {
    return 'remote_url';
  }
  if (image?.uri) {
    return 'local_or_private_uri';
  }

  return 'none';
}

function logScanDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(event, details);
}

function logAi(event: 'openrouter_ai', details: Record<string, unknown>) {
  logScanDebug(event, details);
}

function getAiLogDetails(
  config: ReturnType<typeof getAiConfig>,
  model: string,
  details: Record<string, unknown>,
) {
  return {
    ...details,
    aiEnabled: config.enabled,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    model,
    provider: config.provider,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  };
}

function getFallbackLogDetails(
  error: unknown,
  config: ReturnType<typeof getAiConfig>,
  model: string,
) {
  if (error instanceof OpenRouterProviderError) {
    return error.failure;
  }

  return getAiLogDetails(config, model, {
    openRouterErrorMessage: error instanceof Error ? error.message : 'Unknown OpenRouter error.',
    reason: 'openrouter_unknown_error',
  });
}

function getFallbackReason(details: Record<string, unknown>) {
  const reason = typeof details.reason === 'string' ? details.reason : 'openrouter_unknown_error';
  const httpStatus = typeof details.httpStatus === 'number' ? details.httpStatus : undefined;
  if (reason === 'openrouter_http_error' && httpStatus) {
    return `openrouter_http_error_${httpStatus}`;
  }
  return reason;
}

function createAiDebugMetadata(
  config: ReturnType<typeof getAiConfig>,
  aiSource: AiSource,
  confidence: number,
  fallbackReason?: string,
) {
  return {
    aiSource,
    aiProvider: config.provider,
    visionModel: config.openRouterVisionModel,
    recipeModel: config.openRouterTextModel,
    fallbackReason,
    confidence,
  };
}

// ── Platter component coverage ────────────────────────────────────────────────

// Derive structured detected components from the flat visibleIngredients list.
// All components get the same confidence as the overall scan — position in the
// list does not reliably indicate certainty (the vision model may order by
// prominence, spatial position, or quantity, not by confidence).
// Parses optional leading quantity ("6 salmon nigiri" → estimatedQuantity 6).
// A leading unit word ("1 tablespoon spicy mayo" → "Spicy Mayo") is stripped
// so component names stay clean for coverage matching.
function buildDetectedComponents(
  visibleIngredients: string[],
  baseConfidence: number,
): DetectedComponent[] {
  // ponytail: flat confidence per scan, not per position — no evidence ordering = certainty
  const confidence = Math.min(0.99, baseConfidence);
  return visibleIngredients
    .filter((item) => item.trim().length > 0)
    .map((item) => {
      const quantityMatch = item.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (quantityMatch) {
        const quantity = parseFloat(quantityMatch[1]);
        const rawName = stripLeadingUnit(quantityMatch[2].trim());
        return {
          name: titleCase(rawName),
          confidence,
          estimatedQuantity: isFinite(quantity) ? quantity : undefined,
        };
      }
      return { name: titleCase(item.trim()), confidence };
    });
}

// Strip a leading unit word so "tablespoon spicy mayo" → "spicy mayo" and
// "strips bacon" → "bacon". Matches culinary measure words only.
const UNIT_WORDS = /^(tablespoon|teaspoon|tbsp|tsp|cup|ounce|oz|pound|lb|gram|g|ml|piece|pieces|slice|slices|strip|strips|sprig|sprigs|mound|dash|pinch|handful|clove|cloves|can|jar|bag|bunch)\s+/i;
function stripLeadingUnit(value: string): string {
  return value.replace(UNIT_WORDS, '').trim();
}

// Returns true when this scan looks like a multi-component platter meal where
// every component should have its own ingredientGroup.
function isPlatterStyleMeal(analysis: FoodImageAnalysis): boolean {
  const text = `${analysis.dishName} ${analysis.broadDishCategory}`.toLowerCase();
  const platterWords = ['platter', 'board', 'bento', 'sushi', 'dim sum', 'mezze', 'tapas', 'charcuterie', 'sampler', 'assortment', 'spread'];
  return (
    analysis.broadDishCategory === 'mixed platter' ||
    platterWords.some((w) => text.includes(w)) ||
    (analysis.detectedComponents?.length ?? 0) >= 4
  );
}

function extractGeneratedComponents(recipe: Recipe): string[] {
  return (recipe.ingredientGroups ?? [])
    .map((g) => g.component)
    .filter((c): c is string => Boolean(c));
}

function computeCoverage(
  detected: DetectedComponent[],
  generated: string[],
): { coveragePercent: number; missingComponents: string[] } {
  if (detected.length === 0) return { coveragePercent: 100, missingComponents: [] };
  const missing = detected.filter((d) => !isComponentCovered(d.name, generated));
  return {
    coveragePercent: Math.round((1 - missing.length / detected.length) * 100),
    missingComponents: missing.map((d) => d.name),
  };
}

// A detected component is "covered" by a generated group when either:
//   a) name-level containment: one name contains the other ("Nigiri" ⊂ "Salmon Nigiri")
//   b) token overlap: ≥60% of the SHORTER name's tokens appear in the other name
//      (bidirectional — catches "Salmon Nigiri" ↔ "Nigiri" AND "Patatas Bravas" ↔ "Bravas")
// ponytail: no embeddings — token overlap is good enough until we have FP/FN data
function isComponentCovered(detectedName: string, generatedComponents: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const dNorm = norm(detectedName);
  return generatedComponents.some((g) => {
    const gNorm = norm(g);
    // Fast path: exact or substring containment in either direction
    if (gNorm === dNorm || gNorm.includes(dNorm) || dNorm.includes(gNorm)) return true;
    // Token overlap on the shorter side (bidirectional)
    const dTokens = dNorm.split(' ').filter((t) => t.length > 2);
    const gTokens = gNorm.split(' ').filter((t) => t.length > 2);
    if (dTokens.length === 0 || gTokens.length === 0) return false;
    const shorter = dTokens.length <= gTokens.length ? dTokens : gTokens;
    const longer = dTokens.length <= gTokens.length ? gTokens : dTokens;
    const hits = shorter.filter((t) => longer.some((lt) => lt.includes(t) || t.includes(lt)));
    return hits.length >= Math.ceil(shorter.length * 0.6);
  });
}

function mergeRepairIntoRecipe(
  recipe: Recipe,
  repair: ComponentRepairOutput,
  analysis: FoodImageAnalysis,
): Recipe {
  // Deduplicate: skip repair groups whose component name already matches an
  // existing group (same fuzzy rule as coverage matching — prevents double-groups
  // when the matcher had a false negative and repair re-generated the same item).
  const existingGroupNames = (recipe.ingredientGroups ?? []).map((g) => g.component);
  const newGroups: RecipeIngredientGroup[] = repair.ingredientGroups
    .filter((g) => g.component && g.items.length > 0 && !isComponentCovered(g.component, existingGroupNames))
    .map((g) => ({ component: g.component, items: g.items.map(toRecipeIngredient) }));

  const newIngredients = repair.ingredients.map(toRecipeIngredient);
  const newStepTexts = repair.steps.map(getStepText).filter(Boolean) as string[];

  // Renumber: repair steps arrive with stepNumber starting at 1. Offset them
  // so structuredSteps has no duplicate stepNumbers after merge.
  const stepOffset = recipe.structuredSteps?.length ?? 0;
  const newStructuredSteps = repair.steps
    .map((s, i) => toStructuredStep(s, newStepTexts[i] ?? '', analysis))
    .filter((s): s is RecipeStep => Boolean(s?.text))
    .map((s, i) => ({ ...s, stepNumber: stepOffset + i + 1 }));

  const allIngredients = [...recipe.ingredients, ...newIngredients];

  return {
    ...recipe,
    ingredientGroups: [...(recipe.ingredientGroups ?? []), ...newGroups],
    ingredients: allIngredients,
    steps: [...recipe.steps, ...newStepTexts],
    structuredSteps: recipe.structuredSteps
      ? [...recipe.structuredSteps, ...newStructuredSteps]
      : recipe.structuredSteps,
    groceryItems: getGroceryItems(allIngredients, analysis),
  };
}

async function ensureComponentCoverage(
  result: GeneratedRecipeOutput,
  analysis: FoodImageAnalysis,
  config: AiConfig,
): Promise<GeneratedRecipeOutput> {
  const detected = analysis.detectedComponents ?? [];
  if (detected.length === 0) return result;

  const recipe = result.recipe!;
  const generated = extractGeneratedComponents(recipe);
  const { coveragePercent, missingComponents } = computeCoverage(detected, generated);

  const repairNeeded = coveragePercent < 90 && missingComponents.length > 0;
  let repairAddedComponents = 0;
  let repairedRecipe = recipe;

  if (repairNeeded) {
    console.log('[component-coverage] repair triggered', {
      dish: analysis.dishName,
      coveragePercent,
      missing: missingComponents,
    });
    try {
      const repairOutput = await callComponentRepairWithOpenRouter({
        analysis,
        config,
        missingComponents,
        existingIngredientGroups: recipe.ingredientGroups ?? [],
      });
      repairedRecipe = mergeRepairIntoRecipe(recipe, repairOutput, analysis);
      // mergeRepairIntoRecipe appends steps after the serve step; re-run the
      // timeline validator so component repair steps land before serve.
      if (repairedRecipe.structuredSteps) {
        repairedRecipe = {
          ...repairedRecipe,
          structuredSteps: validateTimeline(repairedRecipe.structuredSteps),
        };
      }
      repairAddedComponents = repairOutput.ingredientGroups.length;
    } catch (repairError) {
      console.warn('[component-coverage] repair failed', {
        dish: analysis.dishName,
        reason: repairError instanceof OpenRouterProviderError ? repairError.failure.reason : 'unknown',
      });
    }
  }

  // Re-measure coverage on the final recipe so analytics reflect actual outcome.
  const finalGenerated = extractGeneratedComponents(repairedRecipe);
  const { coveragePercent: finalCoveragePercent } = computeCoverage(detected, finalGenerated);

  void recordPlatterCoverage({
    dish: analysis.dishName,
    model: config.openRouterTextModel,
    broadDishCategory: analysis.broadDishCategory,
    detectedComponentCount: detected.length,
    generatedComponentCount: generated.length,
    missingComponentCount: missingComponents.length,
    missingComponentNames: missingComponents,
    coveragePercent,
    finalCoveragePercent,
    repairTriggered: repairNeeded,
    repairAddedComponents,
    repairSucceeded: repairNeeded && finalCoveragePercent > coveragePercent,
  });

  return repairNeeded && repairAddedComponents > 0
    ? { ...result, recipe: repairedRecipe }
    : result;
}
