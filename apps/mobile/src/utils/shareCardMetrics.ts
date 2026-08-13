import type { Recipe } from '../mocks';
import type { RecipeFeedback } from '../state/useOkyoStore';
import { getNormalizedRecipeDifficulty } from './recipeIntegrity';

export type ShareMetricKey =
  | 'time'
  | 'protein'
  | 'difficulty'
  | 'calories'
  | 'carbs'
  | 'fat'
  | 'servings'
  | 'steps'
  | 'cuisine'
  | 'cost'
  | 'rating';

export type ShareMetric = { key: ShareMetricKey; label: string; value: string };

export function getShareMetrics(recipe: Recipe, servings: number, feedback?: RecipeFeedback): ShareMetric[] {
  const nutrition = recipe.nutritionEstimate;
  const metrics: Array<ShareMetric | null> = [
    positiveNumber(getTotalTime(recipe)) ? metric('time', 'Time', formatDuration(getTotalTime(recipe))) : null,
    validNutrition(nutrition?.proteinGrams) ? metric('protein', 'Protein', `${Math.round(nutrition!.proteinGrams)}g`) : null,
    metric('difficulty', 'Difficulty', getNormalizedRecipeDifficulty(recipe)),
    validNutrition(nutrition?.calories) ? metric('calories', 'Calories', `${Math.round(nutrition!.calories)} kcal`) : null,
    validNutrition(nutrition?.carbohydratesGrams) ? metric('carbs', 'Carbs', `${Math.round(nutrition!.carbohydratesGrams)}g`) : null,
    validNutrition(nutrition?.fatGrams) ? metric('fat', 'Fat', `${Math.round(nutrition!.fatGrams)}g`) : null,
    positiveNumber(servings) ? metric('servings', 'Servings', `${Math.round(servings)} servings`) : null,
    getStepCount(recipe) > 0 ? metric('steps', 'Steps', `${getStepCount(recipe)} steps`) : null,
    getCuisine(recipe) ? metric('cuisine', 'Cuisine', getCuisine(recipe)!) : null,
    validCost(recipe.estimatedHomemadeCost) ? metric('cost', 'Cost', `~$${recipe.estimatedHomemadeCost.toFixed(2)}`) : null,
    feedback ? metric('rating', 'Rating', formatRating(feedback.rating)) : null,
  ];
  return metrics.filter((item): item is ShareMetric => item !== null);
}

export function getDefaultShareMetricKeys(metrics: ShareMetric[]): ShareMetricKey[] {
  const preferred: ShareMetricKey[] = ['time', 'protein', 'difficulty', 'calories', 'steps', 'cuisine'];
  return preferred.filter((key) => metrics.some((metricItem) => metricItem.key === key)).slice(0, 3);
}

export function getMetricRows<T>(items: T[]): T[][] {
  const count = items.length;
  if (count <= 3) return count ? [items] : [];
  const rowCounts = count === 4 ? [2, 2]
    : count === 5 ? [3, 2]
      : count === 7 ? [3, 2, 2]
        : count === 8 ? [3, 3, 2]
          : count === 10 ? [3, 3, 2, 2]
            : count % 3 === 1 ? [...Array(Math.floor((count - 4) / 3)).fill(3), 2, 2]
              : count % 3 === 2 ? [...Array(Math.floor((count - 2) / 3)).fill(3), 2]
                : Array(Math.floor(count / 3)).fill(3);
  const rows: T[][] = [];
  let index = 0;
  for (const rowCount of rowCounts) {
    rows.push(items.slice(index, index + rowCount));
    index += rowCount;
  }
  return rows;
}

function metric(key: ShareMetricKey, label: string, value: string): ShareMetric { return { key, label, value }; }
function positiveNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function validNutrition(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function validCost(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function getStepCount(recipe: Recipe) { return recipe.structuredSteps?.length ?? recipe.steps?.length ?? 0; }
function getTotalTime(recipe: Recipe) { return positiveNumber(recipe.totalTimeMinutes) ? recipe.totalTimeMinutes : (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0); }
function formatDuration(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`; }
function formatRating(rating: RecipeFeedback['rating']) { return rating === 'loved' ? 'Loved it' : rating === 'okay' ? 'It was okay' : "Didn't like it"; }
function getCuisine(recipe: Recipe) {
  const text = `${recipe.title} ${recipe.description} ${recipe.mainIngredientsSummary ?? ''}`.toLowerCase();
  const matches: Array<[RegExp, string]> = [[/(sushi|katsu|ramen|teriyaki|udon|miso)/, 'Japanese'], [/(taco|burrito|quesadilla|enchilada|salsa)/, 'Mexican'], [/(pasta|rigatoni|pizza|parmesan|gnocchi|alfredo)/, 'Italian'], [/(burger|sandwich|bbq|mac and cheese|fries)/, 'American'], [/(curry|masala|paneer|naan)/, 'Indian'], [/(pho|banh mi|lemongrass)/, 'Vietnamese'], [/(noodle|dumpling|fried rice|chow)/, 'Asian-inspired']];
  return matches.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
