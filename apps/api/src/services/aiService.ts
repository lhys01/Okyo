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
  type OpenRouterVisionOutput,
} from './openRouterProvider.js';
import { logScanEvaluation } from './scanEvalLogger.js';

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const confidenceSchema = z.number().min(0).max(1);
const matchScoreSchema = z.number().min(0).max(10);
const aiSourceSchema = z.enum(['openrouter_ai', 'mock_ai', 'fallback_ai']);
const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];
const defaultRestaurantPrice = 18;
const defaultHomemadeCost = 6.5;

export type AiSource = z.infer<typeof aiSourceSchema>;

export const foodImageAnalysisSchema = z.object({
  candidateScanId: z.string().min(1),
  aiSource: aiSourceSchema,
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
  aiSource: AiSource;
  aiProvider: 'openrouter';
  visionModel: string;
  recipeModel: string;
  fallbackReason?: string;
  confidence: number;
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
      likelyIngredients: normalized.likelyIngredients,
      matchScore: getMatchScoreFromConfidence(normalized.confidence),
      modes: recipeModes,
      notes: ['OpenRouter test output; verify before using.'],
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
    return generateRecipeFromDishWithMock(input, 'fallback_ai', getFallbackReason(fallbackDetails));
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
  const fallback = createFallbackScan(input.mode, config, 'ai_scan_failed');

  try {
    const analysis = await analyzeFoodImage(input);
    const generatedRecipe = await generateRecipeFromDish({ analysis, mode: input.mode });
    const recipe = generatedRecipe.recipe ?? getRecipeById(generatedRecipe.recipeId) ?? fallback.recipe;

    if (!recipe) {
      logAi('fallback_ai', { reason: 'recipe_missing' });
      const fallbackResult = createFallbackScan(input.mode, config, 'recipe_missing');
      await logScanEvaluation({
        aiSource: fallbackResult.aiSource,
        config,
        fallbackReason: fallbackResult.fallbackReason,
        scan: fallbackResult.scan,
      });

      return fallbackResult;
    }

    const costEstimate = estimateIngredientCosts({ analysis, recipe });
    const seedScan = getScanById(analysis.candidateScanId) ?? fallback.scan;
    const usedOpenRouterAnalysis = analysis.notes.includes('OpenRouter test output; verify before using.');
    const fallbackReason = generatedRecipe.fallbackReason ?? analysis.fallbackReason;
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
      scan,
      recipe,
      groceryList: getGroceryList(seedScan.groceryListId),
      shareCard: getShareCard(seedScan.shareCardId),
      note: usedOpenRouterAnalysis
        ? 'AI provider output is for testing only. No image was stored; verify all food, cost, and recipe details.'
        : 'Mock AI service output only. No image was stored and no AI provider was called.',
      ...createAiDebugMetadata(config, aiSource, scan.confidence, fallbackReason),
    };

    await logScanEvaluation({
      aiSource: result.aiSource,
      config,
      fallbackReason: result.fallbackReason,
      scan,
    });

    return result;
  } catch {
    logAi('fallback_ai', { reason: 'ai_scan_failed' });
    const fallbackResult = createFallbackScan(input.mode, config, 'ai_scan_failed');
    await logScanEvaluation({
      aiSource: fallbackResult.aiSource,
      config,
      fallbackReason: fallbackResult.fallbackReason,
      scan: fallbackResult.scan,
    });

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
  return generatedRecipeOutputSchema.parse({
    recipeId: recipe.id,
    title: recipe.title,
    mode: recipe.mode,
    aiSource,
    confidence: Math.min(input.analysis.confidence, 0.86),
    confidenceNote: recipe.confidenceNote,
    fallbackReason,
  });
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
  const variant = getRecipeVariant(output, mode);
  const recipe = createRecipeFromVariant(variant, analysis, mode);

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
): Recipe {
  const restaurantPrice = normalizeRestaurantPrice(analysis.restaurantPriceEstimate);
  const homemadeCost = getModeHomemadeCost(analysis.homemadeCostEstimate, restaurantPrice, mode);
  const title = getRecipeTitle(variant.title, analysis.dishName, mode);
  const ingredients = getRecipeIngredients(variant.ingredients, analysis);
  const steps = getRecipeSteps(variant.steps, analysis.dishName);

  return {
    id: `ai-${slugify(analysis.dishName)}-${slugify(mode)}`,
    scanResultId: analysis.candidateScanId,
    title,
    mode,
    description: ensureInspiredCopy(getOneSentence(variant.description, `${title} with flexible, home-kitchen ingredients.`)),
    prepTimeMinutes: parseMinutes(variant.prepTime, 15),
    cookTimeMinutes: parseMinutes(variant.cookTime, 25),
    servings: 2,
    difficulty: normalizeDifficulty(variant.difficulty),
    estimatedHomemadeCost: homemadeCost,
    estimatedSavings: Math.max(0, restaurantPrice - homemadeCost),
    ingredients,
    steps,
    substitutions: getSafeList(variant.substitutions, getDefaultSubstitutions(mode), 3),
    pantryNote: getShortText(variant.pantryNote, 'Assumes salt, pepper, and basic oil are on hand.', 90),
    confidenceNote: `AI-assisted testing output. Confidence: ${Math.round(analysis.confidence * 100)}%. ${analysis.confidenceReason}`,
  };
}

function createFallbackScan(
  mode: RecipeMode,
  config: ReturnType<typeof getAiConfig> = getAiConfig(),
  fallbackReason = 'fallback_scan',
): AiScanResult {
  const scan = mockScanResults[0];
  const recipe = getRecipeForScan(scan, mode);

  return {
    scan,
    recipe,
    groceryList: getGroceryList(scan.groceryListId),
    shareCard: getShareCard(scan.shareCardId),
    note: 'Fallback mock scan only. AI-shaped output was missing or invalid.',
    ...createAiDebugMetadata(config, 'fallback_ai', scan.confidence, fallbackReason),
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

function normalizeVisionOutput(output: OpenRouterVisionOutput) {
  const confidence = normalizeConfidence(output.confidence);
  const restaurantPriceEstimate = normalizeRestaurantPrice(output.restaurantPriceEstimate);
  const homemadeCostEstimate = normalizeHomemadeCost(output.homemadeCostEstimate, restaurantPriceEstimate);
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
    likelyIngredients,
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
      : `${dishName} Copycat-style`;

  return ensureCopycatTitle(getShortText(value, fallbackTitle, 90));
}

function getRecipeIngredients(values: string[], analysis: FoodImageAnalysis) {
  const fallback = analysis.likelyIngredients.length > 0
    ? analysis.likelyIngredients
    : ['main ingredient', 'sauce base', 'seasoning'];

  return getSafeList(values, fallback, 6).map(toRecipeIngredient);
}

function getRecipeSteps(values: string[], dishName: string) {
  return getSafeList(values, [
    `Prep ingredients for the ${dishName.toLowerCase()}.`,
    'Cook aromatics or base ingredients until fragrant.',
    'Add sauce and main ingredients, then simmer briefly.',
    'Taste, adjust seasoning, and serve warm.',
  ], 5);
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
  const cleaned = getShortText(value, 'ingredient', 80);
  const quantityMatch = cleaned.match(/^([\d./\s]+(?:cup|cups|tbsp|tsp|oz|lb|lbs|g|ml|clove|cloves|slice|slices|can|cans)?)\s+(.+)$/i);
  if (quantityMatch) {
    return {
      name: quantityMatch[2].trim(),
      quantity: quantityMatch[1].trim(),
    };
  }

  return {
    name: cleaned,
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
