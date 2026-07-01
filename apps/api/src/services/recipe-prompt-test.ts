// ponytail: one-shot test script, delete after use
import { generateRecipeWithOpenRouter, openRouterRecipeOutputSchema } from './openRouterProvider.js';
import { getAiConfig } from '../config/aiConfig.js';
import type { FoodImageAnalysis } from './aiService.js';

const baseAnalysis: Omit<FoodImageAnalysis, 'dishName' | 'broadDishCategory' | 'visibleIngredients' | 'likelyIngredients'> = {
  candidateScanId: 'test-001',
  aiSource: 'openrouter',
  cuisine: 'American',
  restaurantStyle: 'Casual',
  scanState: 'clear_food',
  confidence: 90,
  confidenceReason: 'Clear image',
  isFoodImage: true,
  isRestaurantMeal: true,
  restaurantPriceEstimate: 12,
  homemadeCostEstimate: 4,
  matchScore: 85,
  difficulty: 'Easy',
  modes: ['Restaurant Copy'],
  notes: [],
  detectedComponents: [],
  possibleDishNames: [],
  visibleComponents: { protein: '', sauce: '', baseStarch: '', vegetables: '', toppingsGarnish: '', cookingMethod: '' },
};

const dishes: FoodImageAnalysis[] = [
  {
    ...baseAnalysis,
    candidateScanId: 'test-burger',
    dishName: 'Classic Cheeseburger',
    broadDishCategory: 'burger/sandwich',
    visibleIngredients: ['beef patty', 'cheddar cheese', 'brioche bun', 'lettuce', 'tomato', 'pickles', 'onion'],
    likelyIngredients: ['ketchup', 'mustard', 'mayo', 'garlic powder', 'salt', 'pepper'],
  },
  {
    ...baseAnalysis,
    candidateScanId: 'test-fried-rice',
    dishName: 'Chicken Fried Rice',
    broadDishCategory: 'rice bowl',
    cuisine: 'Chinese',
    visibleIngredients: ['jasmine rice', 'chicken breast', 'scrambled egg', 'green onion', 'soy sauce', 'sesame oil', 'frozen peas', 'carrots'],
    likelyIngredients: ['garlic', 'ginger', 'oyster sauce', 'white pepper', 'vegetable oil'],
  },
  {
    ...baseAnalysis,
    candidateScanId: 'test-ramen',
    dishName: 'Tonkotsu Ramen',
    broadDishCategory: 'pasta/noodles',
    cuisine: 'Japanese',
    visibleIngredients: ['ramen noodles', 'chashu pork', 'soft boiled egg', 'nori', 'green onion', 'bamboo shoots', 'corn'],
    likelyIngredients: ['pork bones', 'soy sauce', 'mirin', 'sake', 'sesame oil', 'garlic', 'ginger'],
  },
];

async function runTest() {
  const config = getAiConfig();

  for (const analysis of dishes) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DISH: ${analysis.dishName}`);
    console.log('='.repeat(60));

    const start = Date.now();
    let compactRetry = false;
    let schemaValid = false;
    let error: string | undefined;

    // Patch console.log to capture token_usage and recipe_retry events
    const origLog = console.log;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let finishReason: string | undefined;

    console.log = (msg: unknown, ...args: unknown[]) => {
      origLog(msg, ...args);
      if (msg === '[token_usage]' && args[0] && typeof args[0] === 'object') {
        const u = args[0] as Record<string, unknown>;
        if (u.stage === 'recipe') {
          promptTokens = u.promptTokens as number;
          completionTokens = u.completionTokens as number;
          finishReason = u.finishReason as string;
        }
      }
      if (msg === 'openrouter_recipe_retry') {
        compactRetry = true;
      }
    };

    try {
      const recipe = await generateRecipeWithOpenRouter({ analysis, config, mode: 'Restaurant Copy' });
      const parsed = openRouterRecipeOutputSchema.safeParse(recipe);
      schemaValid = parsed.success;

      // Check for ingredientGroups leak
      const hasIngredientGroups = Array.isArray((recipe as Record<string, unknown>).ingredientGroups) &&
        ((recipe as Record<string, unknown>).ingredientGroups as unknown[]).length > 0;

      // Check ingredients are strings
      const ingredientsAreStrings = (recipe.ingredients ?? []).every((i) => typeof i === 'string');

      // Check grocery items have only name/quantity/category
      const extraGroceryFields = (recipe.groceryItems ?? []).some((item) => {
        const keys = Object.keys(item);
        return keys.some((k) => !['name', 'quantity', 'category'].includes(k));
      });

      origLog('RESULT:', {
        promptTokens,
        completionTokens,
        finishReason,
        compactRetry,
        schemaValid,
        hasIngredientGroups,
        ingredientsAreStrings,
        extraGroceryFields,
        elapsed: `${Date.now() - start}ms`,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      origLog('ERROR:', error);
    } finally {
      console.log = origLog;
    }
  }
}

runTest().catch((e) => { console.error(e); process.exit(1); });
