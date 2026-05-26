import { z } from 'zod';

import {
  mockGroceryLists,
  mockRecipes,
  mockScanResults,
  mockShareCards,
} from '../mockData.js';
import type {
  GroceryList,
  Recipe,
  RecipeMode,
  ScanImageMetadata,
  ScanResult,
  ScanSource,
  ShareCard,
} from '../types.js';

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const confidenceSchema = z.number().min(0).max(1);
const matchScoreSchema = z.number().min(0).max(10);

export const foodImageAnalysisSchema = z.object({
  candidateScanId: z.string().min(1),
  dishName: z.string().min(1),
  restaurantStyle: z.string().min(1),
  confidence: confidenceSchema,
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
export type GeneratedRecipeOutput = z.infer<typeof generatedRecipeOutputSchema>;
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

export type MockAiScanResult = {
  scan: ScanResult;
  recipe?: Recipe;
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note: string;
};

export function analyzeFoodImage(input: AnalyzeFoodImageInput): FoodImageAnalysis {
  // TODO: Replace this mock with a real vision provider behind a privacy-safe image upload flow.
  const scan = getSeedScan(input.image, input.source);
  return foodImageAnalysisSchema.parse({
    candidateScanId: scan.id,
    dishName: scan.dishName,
    restaurantStyle: scan.restaurantStyle,
    confidence: input.image?.placeholder ? Math.min(scan.confidence, 0.72) : scan.confidence,
    matchScore: scan.matchScore,
    difficulty: scan.difficulty,
    modes: scan.modes,
    notes: [
      input.image?.uri ? 'Local image metadata was received.' : 'No stored image file was used.',
      'Mock AI analysis only; dish identity is not verified.',
    ],
  });
}

export function generateRecipeFromDish(input: GenerateRecipeFromDishInput): GeneratedRecipeOutput {
  // TODO: Replace this mock with a recipe-generation provider and persist user edits separately.
  const recipe = getRecipeForAnalysis(input.analysis, input.mode);
  return generatedRecipeOutputSchema.parse({
    recipeId: recipe.id,
    title: recipe.title,
    mode: recipe.mode,
    confidence: Math.min(input.analysis.confidence, 0.86),
    confidenceNote: recipe.confidenceNote,
  });
}

export function estimateIngredientCosts(input: EstimateIngredientCostsInput): IngredientCostEstimate {
  // TODO: Replace this mock with a real cost engine and grocery price source.
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

export function createMockAiScan(input: AnalyzeFoodImageInput): MockAiScanResult {
  const fallback = createFallbackScan(input.mode);

  try {
    const analysis = analyzeFoodImage(input);
    const generatedRecipe = generateRecipeFromDish({ analysis, mode: input.mode });
    const recipe = getRecipeById(generatedRecipe.recipeId) ?? fallback.recipe;

    if (!recipe) {
      return fallback;
    }

    const costEstimate = estimateIngredientCosts({ analysis, recipe });
    const seedScan = getScanById(analysis.candidateScanId) ?? fallback.scan;
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
      recipeId: recipe.scanResultId ? seedScan.recipeId : recipe.id,
    };

    return {
      scan,
      recipe,
      groceryList: getGroceryList(seedScan.groceryListId),
      shareCard: getShareCard(seedScan.shareCardId),
      note: 'Mock AI service output only. No image was stored and no AI provider was called.',
    };
  } catch {
    return fallback;
  }
}

function createFallbackScan(mode: RecipeMode): MockAiScanResult {
  const scan = mockScanResults[0];
  const recipe = getRecipeForScan(scan, mode);

  return {
    scan,
    recipe,
    groceryList: getGroceryList(scan.groceryListId),
    shareCard: getShareCard(scan.shareCardId),
    note: 'Fallback mock scan only. AI-shaped mock output was missing or invalid.',
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
