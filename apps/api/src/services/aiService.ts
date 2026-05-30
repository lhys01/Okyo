import { z } from 'zod';

import { getAiConfig } from '../config/aiConfig.js';
import {
  mockGroceryLists,
  mockRecipes,
  mockScanResults,
  mockShareCards,
} from '../mockData.js';
import type {
  Difficulty,
  GroceryCategory,
  GroceryListItem,
  GroceryList,
  Recipe,
  CookingTerm,
  RecipeIngredient,
  RecipeIngredientGroup,
  RecipeStep,
  RecipeMode,
  ScanImageMetadata,
  ScanResult,
  ScanSource,
  ShareCard,
} from '../types.js';
import {
  analyzeFoodImageWithOpenRouter,
  generateRecipeWithOpenRouter,
  OpenRouterProviderError,
  type OpenRouterRecipeOutput,
  type OpenRouterRecipeVariant,
  type OpenRouterVisionOutput,
} from './openRouterProvider.js';
import { logScanEvaluation } from './scanEvalLogger.js';

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const confidenceSchema = z.number().min(0).max(1);
const matchScoreSchema = z.number().min(0).max(10);
const aiSourceSchema = z.enum(['openrouter_ai', 'mock_ai', 'fallback_ai']);
const scanStatusSchema = z.enum(['success', 'partial', 'rejected', 'failed']);
const scanRejectionTypeSchema = z.enum(['not_food', 'unclear_image', 'ai_failed']);
const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];
const defaultRestaurantPrice = 18;
const defaultHomemadeCost = 6.5;
const uploadedImageConfidenceThreshold = 0.35;
const notFoodConfidenceThreshold = 0.78;

export type AiSource = z.infer<typeof aiSourceSchema>;
export type ScanStatus = z.infer<typeof scanStatusSchema>;
export type ScanRejectionType = z.infer<typeof scanRejectionTypeSchema>;

export const foodImageAnalysisSchema = z.object({
  candidateScanId: z.string().min(1),
  aiSource: aiSourceSchema,
  dishName: z.string().min(1),
  cuisine: z.string().min(1),
  restaurantStyle: z.string().min(1),
  confidence: confidenceSchema,
  confidenceReason: z.string().min(1),
  isFoodImage: z.boolean(),
  isRestaurantMeal: z.boolean(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  restaurantPriceEstimate: z.number().nonnegative(),
  homemadeCostEstimate: z.number().nonnegative(),
  matchScore: matchScoreSchema,
  difficulty: difficultySchema,
  fallbackReason: z.string().optional(),
  modes: z.array(recipeModeSchema).min(1),
  notes: z.array(z.string()).default([]),
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
  recipes?: Recipe[];
};
export type IngredientCostEstimate = z.infer<typeof ingredientCostEstimateSchema>;

export type AnalyzeFoodImageInput = {
  image?: ScanImageMetadata;
  source: ScanSource;
  mode: RecipeMode;
};

export type GenerateRecipeFromDishInput = {
  analysis: FoodImageAnalysis;
  mode: RecipeMode;
};

export type EstimateIngredientCostsInput = {
  analysis: FoodImageAnalysis;
  recipe: Recipe;
};

export type AiScanSuccessResult = {
  status: 'success';
  scan: ScanResult;
  recipe?: Recipe;
  recipes?: Recipe[];
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note: string;
  aiSource: AiSource;
  aiProvider: 'openrouter';
  visionModel: string;
  recipeModel: string;
  fallbackReason?: string;
  confidence: number;
  uploadedImage: boolean;
};

export type AiScanPartialResult = {
  status: 'partial';
  scan: ScanResult;
  note: string;
  aiSource: AiSource;
  aiProvider: 'openrouter';
  visionModel: string;
  recipeModel: string;
  fallbackReason?: string;
  confidence: number;
  uploadedImage: boolean;
  partialReason: string;
};

export type AiScanRejectedResult = {
  status: 'rejected' | 'failed';
  scanId: string;
  note: string;
  aiSource: AiSource;
  aiProvider: 'openrouter';
  visionModel: string;
  recipeModel: string;
  fallbackReason?: string;
  confidence: number;
  uploadedImage: boolean;
  rejectionType: ScanRejectionType;
  rejectionReason: string;
};

export type AiScanResult = AiScanSuccessResult | AiScanPartialResult | AiScanRejectedResult;

export async function analyzeFoodImage(input: AnalyzeFoodImageInput): Promise<FoodImageAnalysis> {
  const config = getAiConfig();
  if (!canUseOpenRouter(config)) {
    logAi('mock_ai', getAiLogDetails(config, config.openRouterVisionModel, getMockReason(config)));
    return analyzeFoodImageWithMock(input);
  }

  try {
    const output = await analyzeFoodImageWithOpenRouter({
      config,
      image: input.image,
      mode: input.mode,
    });
    logAi('openrouter_ai', getAiLogDetails(config, config.openRouterVisionModel, { stage: 'vision' }));
    const normalized = normalizeVisionOutput(output);

    return foodImageAnalysisSchema.parse({
      candidateScanId: mockScanResults[0].id,
      aiSource: 'openrouter_ai',
      confidence: normalized.confidence,
      confidenceReason: normalized.confidenceReason,
      cuisine: normalized.cuisine,
      difficulty: getDifficultyFromConfidence(normalized.confidence),
      dishName: normalized.dishName,
      homemadeCostEstimate: normalized.homemadeCostEstimate,
      isFoodImage: normalized.isFoodImage,
      isRestaurantMeal: normalized.isRestaurantMeal,
      likelyIngredients: normalized.likelyIngredients,
      matchScore: getMatchScoreFromConfidence(normalized.confidence),
      modes: recipeModes,
      notes: ['OpenRouter test output; verify before using.'],
      rejectionReason: normalized.rejectionReason,
      restaurantPriceEstimate: normalized.restaurantPriceEstimate,
      restaurantStyle: normalized.cuisine,
      visibleIngredients: normalized.visibleIngredients,
    });
  } catch (error) {
    const fallbackDetails = getFallbackLogDetails(error, config, config.openRouterVisionModel);
    logAi('fallback_ai', fallbackDetails);
    return analyzeFoodImageWithMock(input, 'fallback_ai', getFallbackReason(fallbackDetails));
  }
}

export async function generateRecipeFromDish(
  input: GenerateRecipeFromDishInput,
): Promise<GeneratedRecipeOutput> {
  const config = getAiConfig();
  if (!canUseOpenRouter(config)) {
    logAi('mock_ai', getAiLogDetails(config, config.openRouterTextModel, getMockReason(config)));
    return generateRecipeFromDishWithMock(input);
  }

  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: input.analysis,
      config,
      mode: input.mode,
    });
    logAi('openrouter_ai', getAiLogDetails(config, config.openRouterTextModel, { stage: 'recipe' }));
    return createRecipeFromOpenRouterOutput(output, input.analysis, input.mode);
  } catch (error) {
    const fallbackDetails = getFallbackLogDetails(error, config, config.openRouterTextModel);
    logAi('fallback_ai', fallbackDetails);
    const fallbackReason = getFallbackReason(fallbackDetails);
    const starterRecipe = generateRecipeFromDishWithStarterFallback(input, fallbackReason);
    if (starterRecipe) {
      return starterRecipe;
    }

    return generateRecipeFromDishWithMock(input, 'fallback_ai', fallbackReason);
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

  logAi('fallback_ai', { reason: 'cost_estimate_invalid' });
  return estimateIngredientCostsWithMock(input);
}

export async function createAiScan(input: AnalyzeFoodImageInput): Promise<AiScanResult> {
  const config = getAiConfig();
  const uploadedImage = hasRealUploadedImage(input);

  if (isDemoMockScan(input)) {
    const result = createDemoMockScan(input.mode, config);
    logAi('mock_ai', getAiLogDetails(config, config.openRouterVisionModel, {
      reason: 'demo_mock_scan',
      status: result.status,
      uploadedImage: result.uploadedImage,
    }));
    await logScanEvaluationFromResult(result, config);
    return result;
  }

  if (uploadedImage && !canUseOpenRouter(config)) {
    const fallbackReason = getUnavailableAiReason(config);
    const result = createRejectedScan({
      aiSource: 'mock_ai',
      confidence: 0,
      config,
      fallbackReason,
      rejectionReason: 'Okyo could not analyze this photo because AI scanning is not available locally.',
      rejectionType: 'ai_failed',
      status: 'failed',
      uploadedImage,
    });

    logAi('mock_ai', getAiLogDetails(config, config.openRouterVisionModel, {
      fallbackReason,
      rejectionType: result.rejectionType,
      status: result.status,
      uploadedImage,
    }));
    await logScanEvaluationFromResult(result, config);
    return result;
  }

  if (uploadedImage && !isProviderVisibleImage(input.image)) {
    const result = createRejectedScan({
      aiSource: 'fallback_ai',
      confidence: 0,
      config,
      fallbackReason: 'image_not_available_to_ai',
      rejectionReason: getImageUnavailableReason(input.image),
      rejectionType: 'ai_failed',
      status: 'failed',
      uploadedImage,
    });

    logAi('fallback_ai', getAiLogDetails(config, config.openRouterVisionModel, {
      fallbackReason: result.fallbackReason,
      rejectionType: result.rejectionType,
      status: result.status,
      uploadedImage,
    }));
    await logScanEvaluationFromResult(result, config);
    return result;
  }

  const fallback = createFallbackScan(input.mode, config, 'ai_scan_failed', uploadedImage);

  try {
    const analysis = await analyzeFoodImage(input);
    const analysisRejection = getAnalysisRejection(analysis, uploadedImage);
    if (analysisRejection) {
      const result = createRejectedScan({
        aiSource: analysis.aiSource,
        confidence: analysis.confidence,
        config,
        fallbackReason: analysis.fallbackReason,
        rejectionReason: analysisRejection.rejectionReason,
        rejectionType: analysisRejection.rejectionType,
        status: analysisRejection.status,
        uploadedImage,
      });

      logAi(result.aiSource, getAiLogDetails(config, config.openRouterVisionModel, {
        fallbackReason: result.fallbackReason,
        rejectionType: result.rejectionType,
        status: result.status,
        uploadedImage,
      }));
      await logScanEvaluationFromResult(result, config);
      return result;
    }

    const generatedRecipe = await generateRecipeFromDish({ analysis, mode: input.mode });
    const recipeFallbackReason = generatedRecipe.fallbackReason ?? analysis.fallbackReason;

    if (
      uploadedImage &&
      generatedRecipe.aiSource !== 'openrouter_ai' &&
      !canUseFallbackRecipeForUploadedImage(generatedRecipe)
    ) {
      const result = createPartialScan({
        analysis,
        aiSource: getScanAiSource(analysis.aiSource, generatedRecipe.aiSource, recipeFallbackReason),
        config,
        fallbackReason: recipeFallbackReason,
        partialReason: `Okyo recognized this as ${analysis.dishName}, but could not safely generate the recipe yet. Try again.`,
        uploadedImage,
      });

      logAi(result.aiSource, getAiLogDetails(config, config.openRouterTextModel, {
        fallbackReason: result.fallbackReason,
        status: result.status,
        uploadedImage,
      }));
      await logScanEvaluationFromResult(result, config);
      return result;
    }

    const recipe = generatedRecipe.recipe ?? getRecipeById(generatedRecipe.recipeId) ?? fallback.recipe;
    const recipes = getGeneratedRecipes(generatedRecipe, recipe);

    if (!recipe) {
      logAi('fallback_ai', { reason: 'recipe_missing' });
      const fallbackResult = uploadedImage
        ? createPartialScan({
          analysis,
          aiSource: 'fallback_ai',
          config,
          fallbackReason: 'recipe_missing',
          partialReason: `Okyo recognized this as ${analysis.dishName}, but could not find a safe recipe result. Try again.`,
          uploadedImage,
        })
        : createFallbackScan(input.mode, config, 'recipe_missing', uploadedImage);
      await logScanEvaluationFromResult(fallbackResult, config);

      return fallbackResult;
    }

    const costEstimate = estimateIngredientCosts({ analysis, recipe });
    const seedScan = getScanById(analysis.candidateScanId) ?? fallback.scan;
    if (!seedScan) {
      const result = createRejectedScan({
        aiSource: 'fallback_ai',
        confidence: analysis.confidence,
        config,
        fallbackReason: 'seed_scan_missing',
        rejectionReason: 'Okyo could not prepare a safe scan result. Try another photo.',
        rejectionType: 'ai_failed',
        status: 'failed',
        uploadedImage,
      });

      await logScanEvaluationFromResult(result, config);
      return result;
    }

    const usedOpenRouterAnalysis = analysis.notes.includes('OpenRouter test output; verify before using.');
    const fallbackReason = recipeFallbackReason;
    const aiSource = getScanAiSource(analysis.aiSource, generatedRecipe.aiSource, fallbackReason);
    const scan: ScanResult = {
      ...seedScan,
      confidence: getBlendedConfidence(analysis.confidence, generatedRecipe.confidence, costEstimate.confidence),
      difficulty: analysis.difficulty,
      dishName: analysis.dishName,
      estimatedSavings: costEstimate.estimatedSavings,
      homemadeCost: costEstimate.homemadeCost,
      matchScore: analysis.matchScore,
      modes: analysis.modes,
      restaurantPrice: costEstimate.restaurantPrice,
      restaurantStyle: analysis.restaurantStyle,
    };

    const result = {
      status: 'success' as const,
      scan,
      recipe,
      recipes,
      groceryList: getGroceryListForRecipe(recipe, seedScan.groceryListId),
      shareCard: getShareCard(seedScan.shareCardId),
      note: usedOpenRouterAnalysis
        ? 'AI provider output is for testing only. No image was stored; verify all food, cost, and recipe details.'
        : 'Mock AI service output only. No image was stored and no AI provider was called.',
      ...createAiDebugMetadata(config, aiSource, scan.confidence, fallbackReason),
      uploadedImage,
    };

    await logScanEvaluationFromResult(result, config);

    return result;
  } catch {
    logAi('fallback_ai', { reason: 'ai_scan_failed' });
    const fallbackResult = uploadedImage
      ? createRejectedScan({
        aiSource: 'fallback_ai',
        confidence: 0,
        config,
        fallbackReason: 'ai_scan_failed',
        rejectionReason: 'Okyo could not analyze this photo. Try uploading a clearer food photo.',
        rejectionType: 'ai_failed',
        status: 'failed',
        uploadedImage,
      })
      : createFallbackScan(input.mode, config, 'ai_scan_failed', uploadedImage);

    await logScanEvaluationFromResult(fallbackResult, config);

    return fallbackResult;
  }
}

export const createMockAiScan = createAiScan;

function analyzeFoodImageWithMock(
  input: AnalyzeFoodImageInput,
  aiSource: AiSource = 'mock_ai',
  fallbackReason?: string,
): FoodImageAnalysis {
  const scan = getSeedScan(input.image, input.source);
  return foodImageAnalysisSchema.parse({
    candidateScanId: scan.id,
    aiSource,
    dishName: scan.dishName,
    cuisine: scan.restaurantStyle,
    restaurantStyle: scan.restaurantStyle,
    confidence: input.image?.placeholder ? Math.min(scan.confidence, 0.72) : scan.confidence,
    confidenceReason: 'Seeded mock analysis for local testing; dish identity is not verified.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['pasta', 'tomato sauce', 'cheese'],
    likelyIngredients: ['rigatoni', 'tomato paste', 'cream', 'parmesan', 'red pepper flakes'],
    restaurantPriceEstimate: scan.restaurantPrice,
    homemadeCostEstimate: scan.homemadeCost,
    matchScore: scan.matchScore,
    difficulty: scan.difficulty,
    fallbackReason,
    modes: scan.modes,
    notes: [
      input.image?.uri ? 'Local image metadata was received.' : 'No stored image file was used.',
      'Mock AI analysis only; dish identity is not verified.',
    ],
  });
}

function generateRecipeFromDishWithMock(
  input: GenerateRecipeFromDishInput,
  aiSource: AiSource = 'mock_ai',
  fallbackReason?: string,
): GeneratedRecipeOutput {
  const recipe = getRecipeForAnalysis(input.analysis, input.mode);
  const recipes = getRecipesForAnalysis(input.analysis);
  const parsed = generatedRecipeOutputSchema.parse({
    recipeId: recipe.id,
    title: recipe.title,
    mode: recipe.mode,
    aiSource,
    confidence: Math.min(input.analysis.confidence, 0.86),
    confidenceNote: recipe.confidenceNote,
    fallbackReason,
  });

  return {
    ...parsed,
    recipe,
    recipes,
  };
}

function generateRecipeFromDishWithStarterFallback(
  input: GenerateRecipeFromDishInput,
  fallbackReason?: string,
): GeneratedRecipeOutput | undefined {
  if (!getCommonDishKind(input.analysis)) {
    return undefined;
  }

  const recipes = recipeModes.map((mode) => (
    createRecipeFromVariant(createStarterVariant(input.analysis, mode), input.analysis, mode, {
      idPrefix: 'starter',
      confidenceNotePrefix: 'Starter recipe generated after the AI recipe response failed.',
    })
  ));
  const recipe = recipes.find((candidate) => candidate.mode === input.mode) ?? recipes[0];
  const parsed = generatedRecipeOutputSchema.parse({
    recipeId: recipe.id,
    title: recipe.title,
    mode: input.mode,
    aiSource: 'fallback_ai',
    confidence: Math.min(input.analysis.confidence, 0.72),
    confidenceNote: recipe.confidenceNote,
    fallbackReason,
  });

  return {
    ...parsed,
    recipe,
    recipes,
  };
}

function estimateIngredientCostsWithMock(input: EstimateIngredientCostsInput): IngredientCostEstimate {
  const scan = getScanById(input.analysis.candidateScanId) ?? mockScanResults[0];
  const homemadeCost = normalizeHomemadeCost(input.recipe.estimatedHomemadeCost, scan.restaurantPrice);
  return ingredientCostEstimateSchema.parse({
    restaurantPrice: scan.restaurantPrice,
    homemadeCost,
    estimatedSavings: Math.max(0, scan.restaurantPrice - homemadeCost),
    confidence: Math.min(input.analysis.confidence, 0.82),
    assumptions: [
      'Uses seeded restaurant estimate.',
      'Uses seeded homemade ingredient estimate.',
    ],
  });
}

function createRecipeFromOpenRouterOutput(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
  mode: RecipeMode,
): GeneratedRecipeOutput {
  const recipes = recipeModes.map((recipeMode) => (
    createRecipeFromVariant(getRecipeVariant(output, recipeMode), analysis, recipeMode)
  ));
  const recipe = recipes.find((candidate) => candidate.mode === mode) ?? recipes[0];

  return {
    aiSource: 'openrouter_ai',
    confidence: Math.min(analysis.confidence, 0.82),
    confidenceNote: `AI-assisted testing output. Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
    mode,
    recipe,
    recipes,
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
  const homemadeCost = getModeHomemadeCost(analysis.homemadeCostEstimate, restaurantPrice, mode);
  const title = getRecipeTitle(variant.title, analysis.dishName, mode);
  const ingredients = getRecipeIngredients(variant.ingredients, analysis, mode);
  const prepTimeMinutes = parseMinutes(variant.prepTime, 15);
  const cookTimeMinutes = parseMinutes(variant.cookTime, 25);
  const totalTimeMinutes = parseMinutes(variant.totalTime, prepTimeMinutes + cookTimeMinutes);
  const activeTimeMinutes = parseMinutes(variant.activeTime, Math.min(totalTimeMinutes, prepTimeMinutes + 10));
  const servings = parseServings(variant.servings, 2);
  const skillLevel = normalizeDifficulty(variant.skillLevel || variant.difficulty);
  const steps = getRecipeSteps(variant.steps, analysis.dishName);
  const structuredSteps = getStructuredSteps(variant.steps, steps, analysis);
  const ingredientGroups = getIngredientGroups(variant.ingredientGroups, ingredients, analysis);
  const spicePairings = getSpicePairings(variant.spicePairings, analysis);
  const cookingTerms = getCookingTerms(variant.cookingTerms, steps);
  const groceryItems = getGroceryItems(ingredients, analysis, mode, variant.groceryItems);
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

  return {
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
    substitutions: getSafeList(variant.substitutions, getDefaultSubstitutions(mode), 3).map(cleanRecipeCopy),
    pantryNote: cleanRecipeCopy(getShortText(variant.pantryNote, 'Assumes salt, pepper, and basic oil are on hand.', 90)),
    confidenceNote: `${options.confidenceNotePrefix ?? 'AI-assisted testing output.'} Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
    mainIngredientsSummary: cleanRecipeCopy(getShortText(
      variant.mainIngredientsSummary,
      getDefaultMainIngredientsSummary(ingredients),
      140,
    )),
    equipment: getSafeList(variant.equipment, getDefaultEquipment(analysis), 5).map(cleanRecipeCopy),
    bestFor: cleanRecipeCopy(getShortText(variant.bestFor, getDefaultBestFor(mode), 70)),
    avoidMistake: mistakeWarning,
    mistakeWarning,
    storageAndReheating: storage,
    storage,
    groceryItems,
    spicePairings,
    cookingTerms,
  };
}

function createFallbackScan(
  mode: RecipeMode,
  config: ReturnType<typeof getAiConfig> = getAiConfig(),
  fallbackReason = 'fallback_scan',
  uploadedImage = false,
): AiScanSuccessResult {
  const scan = mockScanResults[0];
  const recipe = getRecipeForScan(scan, mode);
  const recipes = getRecipesForScan(scan);

  return {
    status: 'success',
    scan,
    recipe,
    recipes,
    groceryList: getGroceryList(scan.groceryListId),
    shareCard: getShareCard(scan.shareCardId),
    note: 'Fallback mock scan only. AI-shaped output was missing or invalid.',
    ...createAiDebugMetadata(config, 'fallback_ai', scan.confidence, fallbackReason),
    uploadedImage,
  };
}

function createDemoMockScan(mode: RecipeMode, config: ReturnType<typeof getAiConfig>): AiScanSuccessResult {
  const scan = mockScanResults[0];
  const recipe = getRecipeForScan(scan, mode);
  const recipes = getRecipesForScan(scan);

  return {
    status: 'success',
    scan,
    recipe,
    recipes,
    groceryList: getGroceryList(scan.groceryListId),
    shareCard: getShareCard(scan.shareCardId),
    note: 'Demo mock scan only. No AI provider was called.',
    ...createAiDebugMetadata(config, 'mock_ai', scan.confidence),
    uploadedImage: false,
  };
}

function createRejectedScan(input: {
  aiSource: AiSource;
  confidence: number;
  config: ReturnType<typeof getAiConfig>;
  fallbackReason?: string;
  rejectionReason: string;
  rejectionType: ScanRejectionType;
  status: 'rejected' | 'failed';
  uploadedImage: boolean;
}): AiScanRejectedResult {
  return {
    status: input.status,
    scanId: `scan-${input.status}-${Date.now()}`,
    note: input.rejectionReason,
    rejectionType: input.rejectionType,
    rejectionReason: input.rejectionReason,
    uploadedImage: input.uploadedImage,
    ...createAiDebugMetadata(
      input.config,
      input.aiSource,
      clampConfidence(input.confidence),
      input.fallbackReason,
    ),
  };
}

function createPartialScan(input: {
  analysis: FoodImageAnalysis;
  aiSource: AiSource;
  config: ReturnType<typeof getAiConfig>;
  fallbackReason?: string;
  partialReason: string;
  uploadedImage: boolean;
}): AiScanPartialResult {
  const seedScan = getScanById(input.analysis.candidateScanId) ?? mockScanResults[0];
  const restaurantPrice = normalizeRestaurantPrice(input.analysis.restaurantPriceEstimate);
  const homemadeCost = normalizeHomemadeCost(input.analysis.homemadeCostEstimate, restaurantPrice);
  const scan: ScanResult = {
    ...seedScan,
    confidence: input.analysis.confidence,
    difficulty: input.analysis.difficulty,
    dishName: input.analysis.dishName,
    estimatedSavings: Math.max(0, restaurantPrice - homemadeCost),
    homemadeCost,
    matchScore: input.analysis.matchScore,
    modes: input.analysis.modes,
    restaurantPrice,
    restaurantStyle: input.analysis.restaurantStyle,
  };

  return {
    status: 'partial',
    scan,
    note: input.partialReason,
    partialReason: input.partialReason,
    ...createAiDebugMetadata(
      input.config,
      input.aiSource,
      clampConfidence(input.analysis.confidence),
      input.fallbackReason,
    ),
    uploadedImage: input.uploadedImage,
  };
}

async function logScanEvaluationFromResult(result: AiScanResult, config: ReturnType<typeof getAiConfig>) {
  await logScanEvaluation({
    aiSource: result.aiSource,
    config,
    fallbackReason: result.fallbackReason,
    rejectionReason: result.status === 'rejected' || result.status === 'failed' ? result.rejectionReason : undefined,
    rejectionType: result.status === 'rejected' || result.status === 'failed' ? result.rejectionType : undefined,
    scan: result.status === 'success' || result.status === 'partial' ? result.scan : undefined,
    scanId: result.status === 'success' || result.status === 'partial' ? result.scan.id : result.scanId,
    status: result.status,
    uploadedImage: result.uploadedImage,
  });
}

function getAnalysisRejection(
  analysis: FoodImageAnalysis,
  uploadedImage: boolean,
): { rejectionReason: string; rejectionType: ScanRejectionType; status: 'rejected' | 'failed' } | undefined {
  if (!uploadedImage) {
    return undefined;
  }

  if (analysis.aiSource !== 'openrouter_ai') {
    return {
      status: 'failed',
      rejectionType: 'ai_failed',
      rejectionReason: 'Okyo could not analyze this photo. Try uploading a clearer food photo.',
    };
  }

  if (!analysis.isFoodImage && analysis.confidence >= notFoodConfidenceThreshold) {
    return {
      status: 'rejected',
      rejectionType: 'not_food',
      rejectionReason: analysis.rejectionReason || "This doesn't look like a restaurant meal.",
    };
  }

  if (!analysis.isFoodImage || !analysis.isRestaurantMeal || analysis.confidence < uploadedImageConfidenceThreshold) {
    return {
      status: 'rejected',
      rejectionType: 'unclear_image',
      rejectionReason: 'Okyo could not identify this meal confidently. Try a clearer, closer food photo.',
    };
  }

  return undefined;
}

function hasRealUploadedImage(input: AnalyzeFoodImageInput) {
  return Boolean(
    input.image &&
    !input.image.placeholder &&
    input.source !== 'mock' &&
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

function isDemoMockScan(input: AnalyzeFoodImageInput) {
  return input.source === 'mock' || Boolean(input.image?.placeholder);
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
    return 'Okyo could not analyze this photo because the selected image was too large. Try a smaller or clearer food photo.';
  }
  if (image?.conversionError === 'image_base64_missing') {
    return 'Okyo could not analyze this photo because the image data was not available. Try another photo.';
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

  return 'mock_requested';
}

function getSeedScan(image: ScanImageMetadata | undefined, source: ScanSource) {
  if (image?.placeholder || source === 'camera') {
    return mockScanResults[0];
  }

  return mockScanResults[0];
}

function getRecipeForAnalysis(analysis: FoodImageAnalysis, mode: RecipeMode) {
  const scan = getScanById(analysis.candidateScanId) ?? mockScanResults[0];
  return getRecipeForScan(scan, mode);
}

function getRecipesForAnalysis(analysis: FoodImageAnalysis) {
  const scan = getScanById(analysis.candidateScanId) ?? mockScanResults[0];
  return getRecipesForScan(scan);
}

function getRecipeForScan(scan: ScanResult, mode: RecipeMode) {
  return (
    mockRecipes.find((recipe) => recipe.scanResultId === scan.id && recipe.mode === mode) ??
    mockRecipes.find((recipe) => recipe.scanResultId === scan.id) ??
    mockRecipes[0]
  );
}

function getRecipesForScan(scan: ScanResult) {
  return recipeModes
    .map((mode) => getRecipeForScan(scan, mode))
    .filter((recipe, index, recipes) => recipes.findIndex((candidate) => candidate.id === recipe.id) === index);
}

function getGeneratedRecipes(generatedRecipe: GeneratedRecipeOutput, selectedRecipe?: Recipe) {
  if (generatedRecipe.recipes && generatedRecipe.recipes.length > 0) {
    return generatedRecipe.recipes;
  }
  return selectedRecipe ? [selectedRecipe] : undefined;
}

function canUseFallbackRecipeForUploadedImage(generatedRecipe: GeneratedRecipeOutput) {
  return Boolean(
    generatedRecipe.aiSource === 'fallback_ai' &&
    generatedRecipe.recipe?.id.startsWith('starter-') &&
    generatedRecipe.recipes?.every((recipe) => recipe.id.startsWith('starter-')),
  );
}

function getScanById(scanId: string) {
  return mockScanResults.find((scan) => scan.id === scanId);
}

function getRecipeById(recipeId: string) {
  return mockRecipes.find((recipe) => recipe.id === recipeId);
}

function getGroceryList(groceryListId: string) {
  return mockGroceryLists.find((list) => list.id === groceryListId);
}

function getGroceryListForRecipe(recipe: Recipe, fallbackGroceryListId: string): GroceryList | undefined {
  if (recipe.groceryItems && recipe.groceryItems.length > 0) {
    return {
      id: `grocery-${recipe.id}`,
      items: recipe.groceryItems,
      recipeId: recipe.id,
      title: `${recipe.title} Grocery List`,
    };
  }

  return getGroceryList(fallbackGroceryListId);
}

function getShareCard(shareCardId: string) {
  return mockShareCards.find((card) => card.id === shareCardId);
}

function getBlendedConfidence(...scores: number[]) {
  const validScores = scores.filter((score) => Number.isFinite(score));
  if (validScores.length === 0) {
    return 0.5;
  }

  const average = validScores.reduce((total, score) => total + score, 0) / validScores.length;
  return Math.max(0, Math.min(1, Number(average.toFixed(2))));
}

function getRecipeVariant(output: OpenRouterRecipeOutput, mode: RecipeMode) {
  switch (mode) {
    case 'Budget':
      return output.budget;
    case 'Healthy':
      return output.healthy;
    case 'Restaurant Copy':
      return output.restaurantCopy;
  }
}

function normalizeVisionOutput(output: OpenRouterVisionOutput) {
  const confidence = normalizeConfidence(output.confidence);
  const restaurantPriceEstimate = normalizeRestaurantPrice(output.restaurantPriceEstimate);
  const homemadeCostEstimate = normalizeHomemadeCost(output.homemadeCostEstimate, restaurantPriceEstimate);
  const isFoodImage = normalizeBoolean(output.isFoodImage, true);
  const isRestaurantMeal = normalizeBoolean(output.isRestaurantMeal, isFoodImage);
  const visibleIngredients = getSafeList(output.visibleIngredients, [], 6);
  const likelyIngredients = getSafeList(
    output.likelyIngredients,
    visibleIngredients.length > 0 ? visibleIngredients : ['main ingredient', 'sauce', 'seasoning'],
    6,
  );
  const cuisine = getSafeTextValue(output.cuisine, 'Restaurant-style');
  const dishName = normalizeDishName(output.dishName, cuisine, [...visibleIngredients, ...likelyIngredients]);

  return {
    confidence,
    confidenceReason: getShortText(
      output.confidenceReason,
      'AI estimate based on visible food cues; verify dish and ingredients.',
      160,
    ),
    cuisine,
    dishName,
    homemadeCostEstimate,
    isFoodImage,
    isRestaurantMeal,
    likelyIngredients,
    rejectionReason: getOptionalShortText(output.rejectionReason, 160),
    restaurantPriceEstimate,
    visibleIngredients,
  };
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

function normalizeRestaurantPrice(value: unknown) {
  const parsed = getFiniteNumber(value);
  if (parsed === undefined || parsed < 4) {
    return defaultRestaurantPrice;
  }

  return roundMoney(clampNumber(parsed, 4, 120));
}

function normalizeHomemadeCost(value: unknown, restaurantPrice: number) {
  const parsed = getFiniteNumber(value);
  const defaultCost = Math.min(defaultHomemadeCost, Math.max(2, restaurantPrice * 0.45));
  const rawCost = parsed === undefined || parsed < 1 ? defaultCost : parsed;
  const cappedCost = rawCost >= restaurantPrice ? Math.max(1, restaurantPrice * 0.45) : rawCost;

  return roundMoney(clampNumber(cappedCost, 1, Math.max(1, restaurantPrice - 0.5)));
}

function getModeHomemadeCost(baseCost: number, restaurantPrice: number, mode: RecipeMode) {
  const normalizedBase = normalizeHomemadeCost(baseCost, restaurantPrice);

  switch (mode) {
    case 'Budget':
      return normalizeHomemadeCost(normalizedBase * 0.82, restaurantPrice);
    case 'Healthy':
      return normalizeHomemadeCost(normalizedBase * 1.08, restaurantPrice);
    case 'Restaurant Copy':
      return normalizedBase;
  }
}

function normalizeDishName(value: unknown, cuisine: string, ingredients: string[]) {
  const text = getSafeTextValue(value, '');
  if (text && !isVagueDishName(text)) {
    return titleCase(text);
  }

  const ingredientText = ingredients.join(' ').toLowerCase();
  if (ingredientText.includes('pasta') || ingredientText.includes('rigatoni') || ingredientText.includes('noodle')) {
    return 'Possible Pasta Dish';
  }
  if (ingredientText.includes('rice') || ingredientText.includes('grain') || ingredientText.includes('bowl')) {
    return 'Possible Grain Bowl';
  }
  if (ingredientText.includes('chicken')) {
    return 'Possible Chicken Dish';
  }
  if (ingredientText.includes('salad') || ingredientText.includes('greens')) {
    return 'Possible Salad';
  }
  if (ingredientText.includes('burger') || ingredientText.includes('patty')) {
    return 'Possible Burger';
  }

  return cuisine && cuisine !== 'Restaurant-style' ? `Possible ${titleCase(cuisine)} Dish` : 'Possible Restaurant Dish';
}

function isVagueDishName(value: string) {
  const normalized = value.trim().toLowerCase();
  return ['', 'dish', 'food', 'meal', 'plate', 'restaurant dish', 'unknown', 'unknown dish'].includes(normalized);
}

function getRecipeTitle(value: string, dishName: string, mode: RecipeMode) {
  const fallbackTitle = mode === 'Budget'
    ? `Budget ${dishName} Inspired-by`
    : mode === 'Healthy'
      ? `Lighter ${dishName} Inspired-by`
      : `${dishName} Inspired-by`;

  return ensureInspiredTitle(getShortText(value, fallbackTitle, 90));
}

type CommonDishKind = 'burger' | 'pizza' | 'noodles' | 'pasta' | 'bowl' | 'taco' | 'sandwich';

function getCommonDishKind(analysis: FoodImageAnalysis): CommonDishKind | undefined {
  const text = getAnalysisText(analysis);
  if (includesAny(text, ['burger', 'cheeseburger', 'patty'])) {
    return 'burger';
  }
  if (text.includes('pizza')) {
    return 'pizza';
  }
  if (includesAny(text, ['noodle', 'ramen', 'udon', 'lo mein', 'pad thai'])) {
    return 'noodles';
  }
  if (includesAny(text, ['pasta', 'rigatoni', 'spaghetti', 'penne', 'fettuccine'])) {
    return 'pasta';
  }
  if (includesAny(text, ['bowl', 'rice', 'grain', 'salad'])) {
    return 'bowl';
  }
  if (includesAny(text, ['taco', 'burrito', 'quesadilla'])) {
    return 'taco';
  }
  if (includesAny(text, ['sandwich', 'sub', 'wrap'])) {
    return 'sandwich';
  }

  return undefined;
}

function createStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  const kind = getCommonDishKind(analysis);
  switch (kind) {
    case 'burger':
      return createBurgerStarterVariant(analysis, mode);
    case 'pizza':
      return createPizzaStarterVariant(analysis, mode);
    case 'noodles':
      return createNoodleStarterVariant(analysis, mode);
    case 'pasta':
      return createPastaStarterVariant(analysis, mode);
    case 'bowl':
      return createBowlStarterVariant(analysis, mode);
    case 'taco':
      return createTacoStarterVariant(analysis, mode);
    case 'sandwich':
      return createSandwichStarterVariant(analysis, mode);
    default:
      return createGenericStarterVariant(analysis, mode);
  }
}

function createBaseStarterVariant(input: {
  analysis: FoodImageAnalysis;
  bestFor: string;
  cookTime: string;
  description: string;
  equipment: string[];
  groceryItems?: OpenRouterRecipeVariant['groceryItems'];
  ingredientGroups: OpenRouterRecipeVariant['ingredientGroups'];
  ingredients: string[];
  mistake: string;
  mode: RecipeMode;
  pantryNote?: string;
  prepTime: string;
  spicePairings?: string[];
  steps: string[];
  storage: string;
  substitutions: string[];
  title: string;
}) {
  const prepMinutes = parseMinutes(input.prepTime, 10);
  const cookMinutes = parseMinutes(input.cookTime, 15);

  return {
    activeTime: `${Math.min(prepMinutes + cookMinutes, prepMinutes + 12)} min`,
    avoidMistake: input.mistake,
    bestFor: input.bestFor,
    cookTime: input.cookTime,
    cookingTerms: [],
    description: input.description,
    difficulty: 'Easy',
    equipment: input.equipment.slice(0, 5),
    groceryItems: (input.groceryItems ?? []).slice(0, 12),
    ingredientGroups: input.ingredientGroups.slice(0, 4),
    ingredients: input.ingredients.slice(0, 10),
    mainIngredientsSummary: input.ingredients.slice(0, 5).join(', '),
    mistakeWarning: input.mistake,
    pantryNote: input.pantryNote ?? 'Assumes salt, pepper, and basic oil.',
    prepTime: input.prepTime,
    servings: 2,
    skillLevel: 'Easy',
    spicePairings: (input.spicePairings ?? []).slice(0, 3),
    steps: input.steps.slice(0, 7),
    storage: input.storage,
    storageAndReheating: input.storage,
    substitutions: input.substitutions.slice(0, 3),
    title: getStarterTitle(input.title, input.mode),
    totalTime: `${prepMinutes + cookMinutes} min`,
  } satisfies OpenRouterRecipeVariant;
}

function createBurgerStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  const text = getAnalysisText(analysis);
  const hasCheese = includesAny(text, ['cheese', 'cheeseburger', 'cheddar', 'american']);
  const protein = mode === 'Healthy' ? '8 oz lean ground turkey or veggie patties' : '8 oz ground beef';
  const title = hasCheese ? 'Cheeseburger Homemade Version' : 'Burger Homemade Version';
  const ingredients = [
    protein,
    '1/2 tsp salt',
    '1/4 tsp black pepper',
    '2 burger buns',
    ...(hasCheese ? ['2 slices cheddar or American cheese'] : []),
    '2 tomato slices',
    '2 lettuce leaves',
    '2 tbsp mayonnaise',
    '1 tsp ketchup',
    '1 tsp mustard',
  ];

  return createBaseStarterVariant({
    analysis,
    bestFor: mode === 'Budget' ? 'cheap weeknight burger night' : 'weeknight dinner',
    cookTime: '10 min',
    description: 'A juicy restaurant-style burger with browned edges, cool toppings, and a simple sauce.',
    equipment: ['skillet or grill pan', 'spatula', 'thermometer', 'small bowl', 'cutting board'],
    groceryItems: [
      createStarterGroceryItem('Protein', mode === 'Healthy' ? 'ground turkey or veggie patties' : 'ground beef', '8 oz or 1 small pack'),
      createStarterGroceryItem('Bakery / Bread', 'burger buns', '1 pack'),
      ...(hasCheese ? [createStarterGroceryItem('Dairy', 'sliced cheddar or American cheese', '2 slices or 1 small pack')] : []),
      createStarterGroceryItem('Produce', 'tomato', '1'),
      createStarterGroceryItem('Produce', 'romaine or lettuce', '1 small head or 1 bag'),
      createStarterGroceryItem('Sauces / Condiments', 'mayonnaise, ketchup, or mustard', '', 'Small jar or bottle if needed.'),
      createStarterGroceryItem('Spices', 'salt and black pepper', 'pantry check', undefined, true),
    ],
    ingredientGroups: [
      { component: 'Patty', items: [protein, '1/2 tsp salt', '1/4 tsp black pepper'] },
      { component: 'Sauce', items: ['2 tbsp mayonnaise', '1 tsp ketchup', '1 tsp mustard'] },
      { component: 'Toppings', items: [...(hasCheese ? ['2 slices cheddar or American cheese'] : []), '2 tomato slices', '2 lettuce leaves'] },
      { component: 'Assembly', items: ['2 burger buns'] },
    ],
    ingredients,
    mistake: 'Do not press the patty repeatedly or it will lose juices.',
    mode,
    prepTime: '10 min',
    spicePairings: ['pickle juice', 'smoked paprika', 'extra mustard'],
    steps: [
      'Season the meat for 1 minute, then shape 2 loose patties slightly wider than the buns.',
      'Heat a skillet over medium-high for 2 minutes until a drop of water sizzles.',
      'Cook patties 3-4 minutes per side until browned and 160°F / 71°C inside.',
      'Rest patties 1 minute; while they rest, toast buns and stir the sauce.',
      'Assemble buns with sauce, patty, cheese if using, tomato, lettuce, and extra sauce.',
      'Taste and add a tiny pinch of salt, pepper, or mustard if the burger tastes flat.',
    ],
    storage: 'Store patties separately from buns and toppings. Reheat patties in a skillet and use within 3 days.',
    substitutions: ['No mayo: use Greek yogurt.', 'No beef: use turkey or veggie patties.', 'No cheddar: use American, Swiss, or pepper jack.'],
    title,
  });
}

function createPizzaStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'quick pizza night',
    cookTime: '12 min',
    description: 'A crisp-edged restaurant-style pizza with melty cheese and simple toppings.',
    equipment: ['sheet pan', 'oven', 'knife or pizza cutter'],
    ingredientGroups: [
      { component: 'Crust', items: ['1 small pizza crust or flatbread'] },
      { component: 'Sauce', items: ['1/3 cup pizza sauce'] },
      { component: 'Cheese', items: ['1 cup shredded mozzarella'] },
      { component: 'Toppings', items: ['1/2 cup visible toppings', '1 tsp olive oil'] },
    ],
    ingredients: ['1 small pizza crust or flatbread', '1/3 cup pizza sauce', '1 cup shredded mozzarella', '1/2 cup visible toppings', '1 tsp olive oil'],
    mistake: 'Do not overload toppings or the crust can turn soggy.',
    mode,
    prepTime: '8 min',
    steps: [
      'Heat the oven to 450°F for at least 10 minutes so the crust crisps.',
      'Spread sauce thinly over the crust, leaving a small bare edge.',
      'Add cheese and toppings in an even layer so each slice cooks evenly.',
      'Bake 8-12 minutes until the cheese bubbles and the crust edges brown.',
      'Rest 2 minutes before slicing so the cheese settles.',
    ],
    storage: 'Store slices up to 3 days. Reheat in a skillet or oven until the crust crisps.',
    substitutions: ['Use flatbread instead of dough.', 'Use provolone or parmesan with mozzarella.', 'Use any cooked protein or vegetables.'],
    title: 'Restaurant-Style Pizza Homemade Version',
  });
}

function createNoodleStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'quick lunch or dinner',
    cookTime: '12 min',
    description: 'A glossy restaurant-style noodle bowl with savory sauce and flexible toppings.',
    equipment: ['pot', 'skillet', 'tongs', 'small bowl'],
    ingredientGroups: [
      { component: 'Noodles', items: ['8 oz noodles'] },
      { component: 'Sauce', items: ['2 tbsp soy sauce', '1 tbsp sauce base', '1 tsp sesame oil'] },
      { component: 'Protein/veg', items: ['8 oz protein or vegetables'] },
      { component: 'Garnish', items: ['2 scallions or herbs'] },
    ],
    ingredients: ['8 oz noodles', '2 tbsp soy sauce', '1 tbsp sauce base', '1 tsp sesame oil', '8 oz protein or vegetables', '2 scallions or herbs'],
    mistake: 'Do not overcook the noodles or they will turn mushy in the sauce.',
    mode,
    prepTime: '10 min',
    spicePairings: ['chili crisp', 'lime', 'sesame seeds'],
    steps: [
      'Cook noodles until just tender, then reserve 1/2 cup cooking water.',
      'Stir sauce ingredients in a small bowl for 1 minute until smooth.',
      'Cook protein or vegetables 4-6 minutes until browned or tender.',
      'Toss noodles with sauce for 1-2 minutes until glossy and coated.',
      'Loosen with splashes of cooking water, then finish with garnish.',
    ],
    storage: 'Store up to 3 days. Reheat with a splash of water to loosen the sauce.',
    substitutions: ['Use rice instead of noodles.', 'Use tofu, chicken, or extra vegetables.', 'Use chili crisp for more heat.'],
    title: 'Restaurant-Style Noodles Homemade Version',
  });
}

function createPastaStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  const base = createNoodleStarterVariant(analysis, mode);
  return {
    ...base,
    title: getStarterTitle('Restaurant-Style Pasta Homemade Version', mode),
    description: 'A saucy restaurant-style pasta with a glossy finish and simple pantry-friendly flavor.',
    ingredientGroups: [
      { component: 'Pasta', items: ['8 oz pasta'] },
      { component: 'Sauce', items: ['2 tbsp sauce base', '1/2 cup cream or broth', '1/4 cup cheese'] },
      { component: 'Protein/veg', items: ['1 cup vegetables or 8 oz protein'] },
      { component: 'Garnish', items: ['black pepper or herbs'] },
    ],
    ingredients: ['8 oz pasta', '2 tbsp sauce base', '1/2 cup cream or broth', '1/4 cup cheese', '1 cup vegetables or 8 oz protein', 'black pepper to taste'],
    mistakeWarning: 'Do not drain all the pasta water; it helps the sauce cling.',
    avoidMistake: 'Do not drain all the pasta water; it helps the sauce cling.',
  };
}

function createBowlStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'easy meal prep',
    cookTime: '10 min',
    description: 'A balanced restaurant-style bowl with a warm base, toppings, and a punchy sauce.',
    equipment: ['skillet', 'cutting board', 'small bowl'],
    ingredientGroups: [
      { component: 'Base', items: ['2 cups cooked rice or grains'] },
      { component: 'Protein/veg', items: ['8 oz protein or vegetables'] },
      { component: 'Sauce', items: ['1/4 cup dressing or sauce'] },
      { component: 'Garnish', items: ['herbs or crunchy topping'] },
    ],
    ingredients: ['2 cups cooked rice or grains', '8 oz protein or vegetables', '1/4 cup dressing or sauce', '1 cup greens or vegetables', 'herbs or crunchy topping'],
    mistake: 'Do not skip the sauce; it ties the bowl together.',
    mode,
    prepTime: '10 min',
    steps: [
      'Warm the base for 2 minutes until steamy.',
      'Cook protein or vegetables 4-6 minutes until browned or tender.',
      'Stir sauce in a small bowl until smooth.',
      'Layer base, greens, protein, and toppings in bowls.',
      'Drizzle sauce and taste before adding extra salt or spice.',
    ],
    storage: 'Store components separately up to 3 days. Reheat warm items before assembling.',
    substitutions: ['Use rice, quinoa, or greens as the base.', 'Use chicken, tofu, falafel, or beans.', 'Use any dressing you like.'],
    title: 'Restaurant-Style Bowl Homemade Version',
  });
}

function createTacoStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'fast taco night',
    cookTime: '10 min',
    description: 'Restaurant-style tacos with seasoned filling, warm tortillas, and fresh toppings.',
    equipment: ['skillet', 'spatula', 'cutting board'],
    ingredientGroups: [
      { component: 'Filling', items: ['8 oz protein or beans', '1 tsp taco seasoning'] },
      { component: 'Tortillas', items: ['4 small tortillas'] },
      { component: 'Toppings', items: ['1 cup lettuce or cabbage', '1 tomato or salsa'] },
      { component: 'Sauce', items: ['2 tbsp crema or hot sauce'] },
    ],
    ingredients: ['8 oz protein or beans', '1 tsp taco seasoning', '4 small tortillas', '1 cup lettuce or cabbage', '1 tomato or salsa', '2 tbsp crema or hot sauce'],
    mistake: 'Do not fill cold tortillas or they may crack.',
    mode,
    prepTime: '10 min',
    steps: [
      'Cook the filling 5-7 minutes until browned and hot.',
      'Warm tortillas 30 seconds per side until flexible.',
      'Prep toppings while the filling finishes cooking.',
      'Fill each tortilla with filling, toppings, and sauce.',
      'Taste one bite and add lime, salt, or hot sauce if flat.',
    ],
    storage: 'Store filling separately up to 3 days. Reheat before adding to fresh tortillas.',
    substitutions: ['Use beans instead of meat.', 'Use cabbage instead of lettuce.', 'Use salsa instead of crema.'],
    title: 'Restaurant-Style Tacos Homemade Version',
  });
}

function createSandwichStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'quick lunch',
    cookTime: '6 min',
    description: 'A restaurant-style sandwich with a toasted base, saucy spread, and crisp toppings.',
    equipment: ['skillet or toaster', 'knife', 'cutting board', 'small bowl'],
    ingredientGroups: [
      { component: 'Bread', items: ['2 rolls or 4 bread slices'] },
      { component: 'Filling', items: ['6-8 oz protein or vegetables'] },
      { component: 'Sauce', items: ['2 tbsp mayo or dressing'] },
      { component: 'Toppings', items: ['tomato slices', 'lettuce leaves'] },
    ],
    ingredients: ['2 rolls or 4 bread slices', '6-8 oz protein or vegetables', '2 tbsp mayo or dressing', '2 tomato slices', '2 lettuce leaves'],
    mistake: 'Do not add wet toppings directly to bread without sauce or barrier ingredients.',
    mode,
    prepTime: '8 min',
    steps: [
      'Toast bread 1-2 minutes until lightly golden.',
      'Warm or season the filling 3-4 minutes until hot or flavorful.',
      'Stir sauce in a small bowl until smooth.',
      'Layer sauce, filling, tomato, and lettuce on the bread.',
      'Press gently, slice, and serve while the bread is crisp.',
    ],
    storage: 'Store filling separately up to 3 days. Assemble sandwiches fresh for best texture.',
    substitutions: ['Use wraps instead of bread.', 'Use Greek yogurt instead of mayo.', 'Use any crisp lettuce or greens.'],
    title: 'Restaurant-Style Sandwich Homemade Version',
  });
}

function createGenericStarterVariant(analysis: FoodImageAnalysis, mode: RecipeMode): OpenRouterRecipeVariant {
  return createBaseStarterVariant({
    analysis,
    bestFor: 'weeknight dinner',
    cookTime: '15 min',
    description: 'A flexible restaurant-style homemade version based on the visible dish.',
    equipment: getDefaultEquipment(analysis),
    ingredientGroups: [
      { component: 'Main', items: ['8 oz main ingredient'] },
      { component: 'Sauce', items: ['2 tbsp sauce base'] },
      { component: 'Toppings', items: ['1 cup vegetables or toppings'] },
    ],
    ingredients: ['8 oz main ingredient', '2 tbsp sauce base', '1 cup vegetables or toppings', 'salt and pepper to taste'],
    mistake: getDefaultAvoidMistake(analysis),
    mode,
    prepTime: '10 min',
    steps: getDefaultRecipeSteps(analysis.dishName),
    storage: getDefaultStorageAndReheating(analysis),
    substitutions: getDefaultSubstitutions(mode),
    title: `${analysis.dishName} Homemade Version`,
  });
}

function getStarterTitle(title: string, mode: RecipeMode) {
  if (mode === 'Budget') {
    return `Budget ${title}`;
  }
  if (mode === 'Healthy') {
    return `Lighter ${title}`;
  }

  return title;
}

function createStarterGroceryItem(
  category: GroceryCategory,
  name: string,
  quantity: string,
  shoppingNote = '',
  pantryStaple = false,
): OpenRouterRecipeVariant['groceryItems'][number] {
  return {
    category,
    name,
    pantryStaple,
    quantity,
    shoppingNote,
    sourceIngredient: '',
  };
}

function getRecipeIngredients(values: string[], analysis: FoodImageAnalysis, mode: RecipeMode) {
  const fallback = analysis.likelyIngredients.length > 0
    ? analysis.likelyIngredients
    : ['main ingredient', 'sauce base', 'seasoning'];

  const ingredients = getSafeList(values, fallback, 10).map(toRecipeIngredient);
  return ensureCoreIngredients(ingredients, analysis, mode).slice(0, 10);
}

function getRecipeSteps(values: OpenRouterRecipeVariant['steps'], dishName: string) {
  const fallbackSteps = getDefaultRecipeSteps(dishName);
  const cleanValues = (Array.isArray(values) ? values : [])
    .map(getStepText)
    .filter(Boolean);
  const steps = getSafeList(cleanValues, fallbackSteps, 7).map(cleanRecipeCopy);
  const wordCount = steps.join(' ').split(/\s+/).filter(Boolean).length;
  const shouldUseFallback = steps.length < 5 || wordCount / Math.max(steps.length, 1) < 10;

  return ensureSafetyTemperature(shouldUseFallback ? fallbackSteps : steps, dishName);
}

function getStructuredSteps(
  values: OpenRouterRecipeVariant['steps'],
  steps: string[],
  analysis: FoodImageAnalysis,
): RecipeStep[] {
  const aiSteps = (Array.isArray(values) ? values : [])
    .map((value, index) => toStructuredStep(value, steps[index], analysis))
    .filter((step): step is RecipeStep => Boolean(step?.text))
    .slice(0, 7);

  if (aiSteps.length >= 5) {
    return ensureStructuredStepFallbacks(aiSteps, analysis);
  }

  return ensureStructuredStepFallbacks(
    steps
      .map((step) => toStructuredStep(step, step, analysis))
      .filter((step): step is RecipeStep => Boolean(step)),
    analysis,
  );
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

    return {
      text,
      timeEstimate: cleanRecipeCopy(getShortText(value.timeEstimate, getStepTimeEstimate(text), 42)),
      visualCue: cleanRecipeCopy(getShortText(value.visualCue, getStepVisualCue(text), 110)),
      whyItMatters: getOptionalStepText(value.whyItMatters, 120),
      safetyNote: getOptionalStepText(value.safetyNote, 120) ?? getStepSafetyNote(text, analysis),
      flavorBoost: getOptionalStepText(value.flavorBoost, 120) ?? getStepFlavorBoost(text, analysis),
      cookingTerm,
    };
  }

  return {
    text,
    timeEstimate: getStepTimeEstimate(text),
    visualCue: getStepVisualCue(text),
    safetyNote: getStepSafetyNote(text, analysis),
    flavorBoost: getStepFlavorBoost(text, analysis),
    cookingTerm: getContextCookingTerm(text),
  };
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
    return value.text;
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

function getStepVisualCue(step: string) {
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

  return 'Use the look, smell, and texture cues in the step.';
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

function getStepFlavorBoost(step: string, analysis: FoodImageAnalysis) {
  const text = `${step} ${getAnalysisText(analysis)}`.toLowerCase();
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

function getDefaultRecipeSteps(dishName: string) {
  const dishText = dishName.toLowerCase();

  if (dishText.includes('burger')) {
    return [
      'Mix the patty seasoning for 1 minute, then shape 2 loose patties slightly wider than the buns so they shrink into the right size.',
      'Heat a skillet over medium-high heat for 2 minutes until a drop of water sizzles; add 1 tsp oil if the pan is not nonstick.',
      'Cook the patties for 3-4 minutes per side until deeply browned outside and 160°F inside for ground beef or turkey.',
      'While the patties rest for 1 minute, toast the buns cut-side down until lightly golden and mix the sauce.',
      'Build each burger with sauce, patty, cheese if using, tomato slices, lettuce, and pickles or onion so every bite has crunch.',
      'Taste a tiny bit of sauce or topping, then add a pinch of salt, pepper, or extra mustard if the burger tastes flat.',
    ];
  }
  if (dishText.includes('pasta') || dishText.includes('rigatoni') || dishText.includes('noodle')) {
    return [
      'Bring a pot of salted water to a boil, then cook the pasta or noodles until just tender with a small bite, usually 1 minute less than the package says.',
      'Save 1 cup cooking water before draining; the starch helps the sauce turn glossy instead of watery.',
      'Warm the sauce base in a skillet for 1-2 minutes until it smells rich and looks slightly darker.',
      'Stir in dairy, broth, or sauce liquid over low heat until smooth; lower heat keeps creamy sauces from splitting.',
      'Toss in the noodles for 1-2 minutes, adding splashes of saved water until the sauce coats every piece.',
      'Finish with garnish or spice, taste, and adjust in small pinches while the noodles are still hot.',
    ];
  }

  return [
    `Prep the ingredients for the ${dishName.toLowerCase()} for 5 minutes, keeping sauces and toppings close by so cooking feels calm.`,
    'Cook the main ingredient over medium-high heat for 3-5 minutes per side, until browned outside and cooked through.',
    'Warm or mix the sauce base for 1-2 minutes until glossy, then combine it with the cooked ingredients.',
    'Use the cooking time to prep toppings, garnish, or serving bowls so the final assembly is quick.',
    'Let hot meat, sauce, or filling sit for 1 minute if it looks juicy; this keeps the final bite from turning watery.',
    'Taste, adjust salt or spice in small pinches, and serve while warm.',
  ];
}

function ensureSafetyTemperature(steps: string[], dishName: string) {
  const dishText = dishName.toLowerCase();
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
      items: getSafeList(group.items, [], 8).map(toRecipeIngredient),
    }))
    .filter((group) => group.component && group.items.length > 0)
    .slice(0, 4);

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

function getDefaultBestFor(mode: RecipeMode) {
  if (mode === 'Budget') {
    return 'saving money on a weeknight';
  }
  if (mode === 'Healthy') {
    return 'a lighter homemade dinner';
  }

  return 'a restaurant-style night at home';
}

function getDefaultAvoidMistake(analysis: FoodImageAnalysis) {
  const dishText = getAnalysisText(analysis);

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
  mode: RecipeMode,
  aiItems: OpenRouterRecipeVariant['groceryItems'] = [],
): GroceryListItem[] {
  const dishText = getAnalysisText(analysis);
  const convertedItems = [
    ...ingredients.flatMap((ingredient) => toGroceryItems(ingredient)),
    ...getAiGroceryItems(aiItems),
  ];
  const withCoreItems = ensureCoreGroceryItems(convertedItems, dishText, mode);

  return dedupeGroceryItems(withCoreItems).slice(0, 12);
}

function getAiGroceryItems(values: OpenRouterRecipeVariant['groceryItems']) {
  return (Array.isArray(values) ? values : [])
    .map((item): GroceryListItem | undefined => {
      const name = cleanRecipeCopy(getShortText(item.name, '', 70));
      if (!name) {
        return undefined;
      }

      return {
        category: normalizeGroceryCategory(item.category, name),
        name,
        pantryItem: normalizeBoolean(item.pantryStaple, false),
        pantryStaple: normalizeBoolean(item.pantryStaple, false),
        quantity: cleanRecipeCopy(getShortText(item.quantity, '', 60)),
        shoppingNote: getOptionalShortText(item.shoppingNote, 100),
        sourceIngredient: getOptionalShortText(item.sourceIngredient, 90),
      };
    })
    .filter((item): item is GroceryListItem => Boolean(item));
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
  mode: RecipeMode,
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
      name: mode === 'Healthy' ? 'ground turkey or veggie patties' : 'ground beef',
      quantity: mode === 'Budget' ? '1 lb' : '8 oz or 2 patties',
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
    analysis.cuisine,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getDefaultSubstitutions(mode: RecipeMode) {
  if (mode === 'Budget') {
    return ['Use store-brand staples where possible.'];
  }
  if (mode === 'Healthy') {
    return ['Add extra vegetables or use a lighter sauce.'];
  }

  return ['Use similar pantry ingredients if needed.'];
}

function ensureCoreIngredients(
  ingredients: RecipeIngredient[],
  analysis: FoodImageAnalysis,
  mode: RecipeMode,
) {
  const dishText = [
    analysis.dishName,
    analysis.cuisine,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();
  const result = [...ingredients];

  if (dishText.includes('burger')) {
    addIngredientIfMissing(result, ['bun', 'brioche', 'roll'], {
      name: 'burger buns',
      quantity: '2',
    });
    addIngredientIfMissing(result, ['patty', 'beef', 'turkey', 'veggie patty', 'plant-based'], getBurgerProtein(mode));
    if (dishText.includes('cheese')) {
      addIngredientIfMissing(result, ['cheese', 'cheddar', 'american'], {
        name: 'cheese slices',
        quantity: '2 slices',
      });
    }
    addIngredientIfMissing(result, ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'burger sauce', 'sauce'], {
      name: mode === 'Healthy' ? 'Greek yogurt burger sauce' : 'burger sauce or mayonnaise',
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

  return result;
}

function getBurgerProtein(mode: RecipeMode): RecipeIngredient {
  if (mode === 'Healthy') {
    return { name: 'lean turkey or veggie burger patties', quantity: '2' };
  }
  if (mode === 'Budget') {
    return { name: 'ground beef or turkey', quantity: '1 lb' };
  }

  return { name: 'ground beef burger patties', quantity: '2' };
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
    analysis.cuisine,
    analysis.dishName,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' ').toLowerCase();

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
    { term: 'Season to taste', meaning: 'Add small pinches, taste, then adjust.' },
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

  const quantityMatch = withoutBadAsNeeded.match(/^((?:\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+|one|two|three|four|five|six|a|an)\s*(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|ml|clove|cloves|slice|slices|can|cans|bunch|bunches|stalk|stalks|piece|pieces|large|medium|small)?)\s+(.+)$/i);
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

function cleanIngredientName(value: string) {
  return cleanRecipeCopy(value)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*,?\s*(?:to taste|as needed)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

function cleanRecipeCopy(value: string) {
  return value
    .replace(/\bcipycat\b/gi, 'inspired-by')
    .replace(/\bcopy\s*cat\b/gi, 'inspired-by')
    .replace(/\bcopycat(?:-style)?\b/gi, 'inspired-by')
    .replace(/\bofficial\b/gi, 'restaurant-style')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureInspiredTitle(value: string) {
  const cleaned = cleanRecipeCopy(value);
  if (cleaned.toLowerCase().includes('inspired') || cleaned.toLowerCase().includes('restaurant-style')) {
    return cleaned;
  }

  return `${cleaned} Inspired-by`;
}

function ensureInspiredCopy(value: string) {
  const cleaned = cleanRecipeCopy(value);
  if (cleaned.toLowerCase().includes('inspired') || cleaned.toLowerCase().includes('restaurant-style')) {
    return cleaned;
  }

  return `${cleaned} This is an inspired-by estimate for a home kitchen.`;
}

function getSafeList(values: string[] | undefined, fallback: string[], maxItems: number) {
  const cleanValues = (Array.isArray(values) ? values : [])
    .map((value) => getShortText(value, '', 120))
    .filter(Boolean);
  const source = cleanValues.length > 0 ? cleanValues : fallback;

  return [...new Set(source)].slice(0, maxItems);
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

function getMockReason(config: ReturnType<typeof getAiConfig>) {
  if (!config.enabled) {
    return { reason: 'ai_disabled' };
  }
  if (!config.openRouterApiKey) {
    return { reason: 'openrouter_missing_key' };
  }

  return { reason: 'mock_requested' };
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

function logAi(event: 'mock_ai' | 'openrouter_ai' | 'fallback_ai', details: Record<string, unknown>) {
  console.log(event, details);
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
  return typeof details.reason === 'string' ? details.reason : 'openrouter_unknown_error';
}

function getScanAiSource(
  analysisSource: AiSource,
  recipeSource: AiSource,
  fallbackReason: string | undefined,
): AiSource {
  if (fallbackReason || analysisSource === 'fallback_ai' || recipeSource === 'fallback_ai') {
    return 'fallback_ai';
  }
  if (analysisSource === 'openrouter_ai' && recipeSource === 'openrouter_ai') {
    return 'openrouter_ai';
  }

  return 'mock_ai';
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
