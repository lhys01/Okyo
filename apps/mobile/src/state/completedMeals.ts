import type { CanonicalRecipe } from './canonicalRecipes';
import type { ActiveCookingSession } from './activeCooking';

/** An immutable snapshot of the exact recipe version a person finished cooking. */
export type CompletedMeal = {
  id: string;
  recipeId: string;
  completedAt: string;
  calories?: number;
  proteinGrams?: number;
  carbohydratesGrams?: number;
  fatGrams?: number;
  makeAtHomeCost?: number;
  eatingOutEstimate?: number;
  estimatedSavings?: number;
  goalFriendly: boolean;
};

export function createCompletedMeal(
  recipe: CanonicalRecipe,
  session: ActiveCookingSession,
  completedAt = new Date().toISOString(),
): CompletedMeal {
  const makeAtHomeCost = finitePositive(recipe.estimatedHomemadeCost);
  const eatingOutEstimate = finitePositive(recipe.restaurantPriceEstimate)
    ?? finitePositive(recipe.scanResult?.restaurantPrice);

  return {
    id: `meal-${recipe.id}-${session.startedAt}`,
    recipeId: recipe.id,
    completedAt,
    calories: finiteNumber(recipe.nutritionEstimate?.calories),
    proteinGrams: finiteNumber(recipe.nutritionEstimate?.proteinGrams),
    carbohydratesGrams: finiteNumber(recipe.nutritionEstimate?.carbohydratesGrams),
    fatGrams: finiteNumber(recipe.nutritionEstimate?.fatGrams),
    makeAtHomeCost,
    eatingOutEstimate,
    estimatedSavings: makeAtHomeCost !== undefined && eatingOutEstimate !== undefined
      ? Math.max(0, eatingOutEstimate - makeAtHomeCost)
      : undefined,
    goalFriendly: recipe.selectedPresentationMode === 'Healthier' || recipe.selectedPresentationMode === 'More Protein',
  };
}

export function sanitizeCompletedMeals(value: unknown): CompletedMeal[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    const id = stringValue(record.id);
    const recipeId = stringValue(record.recipeId);
    const completedAt = dateValue(record.completedAt);
    if (!id || !recipeId || !completedAt || ids.has(id)) return [];
    const makeAtHomeCost = finitePositive(record.makeAtHomeCost);
    const eatingOutEstimate = finitePositive(record.eatingOutEstimate);
    ids.add(id);
    return [{
      id,
      recipeId,
      completedAt,
      calories: finiteNumber(record.calories),
      proteinGrams: finiteNumber(record.proteinGrams),
      carbohydratesGrams: finiteNumber(record.carbohydratesGrams),
      fatGrams: finiteNumber(record.fatGrams),
      makeAtHomeCost,
      eatingOutEstimate,
      estimatedSavings: makeAtHomeCost !== undefined && eatingOutEstimate !== undefined
        ? Math.max(0, eatingOutEstimate - makeAtHomeCost)
        : undefined,
      goalFriendly: record.goalFriendly === true,
    }];
  });
}

/** Safely preserves only legacy recipes that were already explicitly completed. */
export function migrateLegacyCompletedMeals(recipes: Record<string, CanonicalRecipe>): CompletedMeal[] {
  return Object.values(recipes).flatMap((recipe) => {
    if (recipe.completionState !== 'completed' || !dateValue(recipe.cookingCompletedAt)) return [];
    return [createCompletedMeal(recipe, {
      recipeId: recipe.id,
      recipeRevisionId: recipe.sourceRecipeId,
      currentStepIndex: 0,
      totalStepCount: 0,
      startedAt: recipe.cookingCompletedAt!,
      lastUpdatedAt: recipe.cookingCompletedAt!,
      completionStatus: 'active',
    }, recipe.cookingCompletedAt)];
  });
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function finiteNonNegative(value: unknown): number | undefined {
  const result = finiteNumber(value);
  return result !== undefined && result >= 0 ? result : undefined;
}

export function finitePositive(value: unknown): number | undefined {
  const result = finiteNumber(value);
  return result !== undefined && result > 0 ? result : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function dateValue(value: unknown): string | undefined {
  const result = stringValue(value);
  return result && Number.isFinite(new Date(result).getTime()) ? result : undefined;
}
