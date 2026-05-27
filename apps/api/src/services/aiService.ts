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
  GroceryList,
  Recipe,
  RecipeIngredient,
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
} from './openRouterProvider.js';

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const confidenceSchema = z.number().min(0).max(1);
const matchScoreSchema = z.number().min(0).max(10);

export const foodImageAnalysisSchema = z.object({
  candidateScanId: z.string().min(1),
  dishName: z.string().min(1),
  cuisine: z.string().min(1),
  restaurantStyle: z.string().min(1),
  confidence: confidenceSchema,
  confidenceReason: z.string().min(1),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  restaurantPriceEstimate: z.number().nonnegative(),
  homemadeCostEstimate: z.number().nonnegative(),
  matchScore: matchScoreSchema,
  difficulty: difficultySchema,
  modes: z.array(recipeModeSchema).min(1),
  notes: z.array(z.string()).default([]),
});

export const generatedRecipeOutputSchema = z.object({
  recipeId: z.string().min(1),
  title: z.string().min(1),
  mode: recipeModeSchema,
  confidence: confidenceSchema,
  confidenceNote: z.string().min(1),
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
};

export type GenerateRecipeFromDishInput = {
  analysis: FoodImageAnalysis;
  mode: RecipeMode;
};

export type EstimateIngredientCostsInput = {
  analysis: FoodImageAnalysis;
  recipe: Recipe;
};

export type AiScanResult = {
  scan: ScanResult;
  recipe?: Recipe;
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note: string;
};

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

    return foodImageAnalysisSchema.parse({
      candidateScanId: mockScanResults[0].id,
      confidence: clampConfidence(output.confidence),
      confidenceReason: output.confidenceReason,
      cuisine: output.cuisine,
      difficulty: 'Medium',
      dishName: output.dishName,
      homemadeCostEstimate: output.homemadeCostEstimate,
      likelyIngredients: output.likelyIngredients,
      matchScore: getMatchScoreFromConfidence(output.confidence),
      modes: ['Restaurant Copy', 'Budget', 'Healthy'],
      notes: ['OpenRouter test output; verify before using.'],
      restaurantPriceEstimate: output.restaurantPriceEstimate,
      restaurantStyle: output.cuisine,
      visibleIngredients: output.visibleIngredients,
    });
  } catch (error) {
    logAi('fallback_ai', getFallbackLogDetails(error, config, config.openRouterVisionModel));
    return analyzeFoodImageWithMock(input);
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
    logAi('fallback_ai', getFallbackLogDetails(error, config, config.openRouterTextModel));
    return generateRecipeFromDishWithMock(input);
  }
}

export function estimateIngredientCosts(input: EstimateIngredientCostsInput): IngredientCostEstimate {
  const estimate = ingredientCostEstimateSchema.safeParse({
    restaurantPrice: input.analysis.restaurantPriceEstimate,
    homemadeCost: input.analysis.homemadeCostEstimate,
    estimatedSavings: input.analysis.restaurantPriceEstimate - input.analysis.homemadeCostEstimate,
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
  const fallback = createFallbackScan(input.mode);

  try {
    const analysis = await analyzeFoodImage(input);
    const generatedRecipe = await generateRecipeFromDish({ analysis, mode: input.mode });
    const recipe = generatedRecipe.recipe ?? getRecipeById(generatedRecipe.recipeId) ?? fallback.recipe;

    if (!recipe) {
      logAi('fallback_ai', { reason: 'recipe_missing' });
      return fallback;
    }

    const costEstimate = estimateIngredientCosts({ analysis, recipe });
    const seedScan = getScanById(analysis.candidateScanId) ?? fallback.scan;
    const usedOpenRouterAnalysis = analysis.notes.includes('OpenRouter test output; verify before using.');
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

    return {
      scan,
      recipe,
      groceryList: getGroceryList(seedScan.groceryListId),
      shareCard: getShareCard(seedScan.shareCardId),
      note: usedOpenRouterAnalysis
        ? 'AI provider output is for testing only. No image was stored; verify all food, cost, and recipe details.'
        : 'Mock AI service output only. No image was stored and no AI provider was called.',
    };
  } catch {
    logAi('fallback_ai', { reason: 'ai_scan_failed' });
    return fallback;
  }
}

export const createMockAiScan = createAiScan;

function analyzeFoodImageWithMock(input: AnalyzeFoodImageInput): FoodImageAnalysis {
  const scan = getSeedScan(input.image, input.source);
  return foodImageAnalysisSchema.parse({
    candidateScanId: scan.id,
    dishName: scan.dishName,
    cuisine: scan.restaurantStyle,
    restaurantStyle: scan.restaurantStyle,
    confidence: input.image?.placeholder ? Math.min(scan.confidence, 0.72) : scan.confidence,
    confidenceReason: 'Seeded mock analysis for local testing; dish identity is not verified.',
    visibleIngredients: ['pasta', 'tomato sauce', 'cheese'],
    likelyIngredients: ['rigatoni', 'tomato paste', 'cream', 'parmesan', 'red pepper flakes'],
    restaurantPriceEstimate: scan.restaurantPrice,
    homemadeCostEstimate: scan.homemadeCost,
    matchScore: scan.matchScore,
    difficulty: scan.difficulty,
    modes: scan.modes,
    notes: [
      input.image?.uri ? 'Local image metadata was received.' : 'No stored image file was used.',
      'Mock AI analysis only; dish identity is not verified.',
    ],
  });
}

function generateRecipeFromDishWithMock(input: GenerateRecipeFromDishInput): GeneratedRecipeOutput {
  const recipe = getRecipeForAnalysis(input.analysis, input.mode);
  return generatedRecipeOutputSchema.parse({
    recipeId: recipe.id,
    title: recipe.title,
    mode: recipe.mode,
    confidence: Math.min(input.analysis.confidence, 0.86),
    confidenceNote: recipe.confidenceNote,
  });
}

function estimateIngredientCostsWithMock(input: EstimateIngredientCostsInput): IngredientCostEstimate {
  const scan = getScanById(input.analysis.candidateScanId) ?? mockScanResults[0];
  return ingredientCostEstimateSchema.parse({
    restaurantPrice: scan.restaurantPrice,
    homemadeCost: input.recipe.estimatedHomemadeCost,
    estimatedSavings: scan.restaurantPrice - input.recipe.estimatedHomemadeCost,
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
  const variant = getRecipeVariant(output, mode);
  const recipe = createRecipeFromVariant(variant, analysis, mode);

  return {
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
): Recipe {
  const homemadeCost = analysis.homemadeCostEstimate;
  const restaurantPrice = analysis.restaurantPriceEstimate;

  return {
    id: `ai-${slugify(analysis.dishName)}-${slugify(mode)}`,
    scanResultId: analysis.candidateScanId,
    title: ensureCopycatTitle(variant.title),
    mode,
    description: ensureInspiredCopy(variant.description),
    prepTimeMinutes: parseMinutes(variant.prepTime, 15),
    cookTimeMinutes: parseMinutes(variant.cookTime, 25),
    servings: 2,
    difficulty: normalizeDifficulty(variant.difficulty),
    estimatedHomemadeCost: homemadeCost,
    estimatedSavings: restaurantPrice - homemadeCost,
    ingredients: variant.ingredients.map(toRecipeIngredient),
    steps: variant.steps,
    substitutions: variant.substitutions,
    pantryNote: variant.pantryNote,
    confidenceNote: `AI-assisted testing output. Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
  };
}

function createFallbackScan(mode: RecipeMode): AiScanResult {
  const scan = mockScanResults[0];
  const recipe = getRecipeForScan(scan, mode);

  return {
    scan,
    recipe,
    groceryList: getGroceryList(scan.groceryListId),
    shareCard: getShareCard(scan.shareCardId),
    note: 'Fallback mock scan only. AI-shaped output was missing or invalid.',
  };
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

function getRecipeForScan(scan: ScanResult, mode: RecipeMode) {
  return (
    mockRecipes.find((recipe) => recipe.scanResultId === scan.id && recipe.mode === mode) ??
    mockRecipes.find((recipe) => recipe.scanResultId === scan.id) ??
    mockRecipes[0]
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

function toRecipeIngredient(value: string): RecipeIngredient {
  return {
    name: value,
    quantity: 'as needed',
  };
}

function ensureCopycatTitle(value: string) {
  if (value.toLowerCase().includes('copycat') || value.toLowerCase().includes('inspired')) {
    return value;
  }

  return `${value} Copycat-style`;
}

function ensureInspiredCopy(value: string) {
  if (value.toLowerCase().includes('copycat') || value.toLowerCase().includes('inspired')) {
    return value;
  }

  return `${value} This is a copycat-style estimate, not an official restaurant recipe.`;
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
