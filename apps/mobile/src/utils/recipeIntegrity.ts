import type { Recipe } from '../mocks';
import { normalizeNutritionEstimate } from './nutrition';

const MAX_RECIPE_MINUTES = 720;
const COOKING_PATTERN = /\b(bake|boil|broil|cook|fry|grill|heat|roast|sauté|saute|sear|simmer|steam|toast)\b/i;
const NO_COOK_PATTERN = /\b(no[- ]cook|smoothie|fruit bowl|yogurt bowl|snack plate)\b/i;
const PIZZA_PATTERN = /\bpizza\b/i;

export function normalizeRecipeForCanonicalStorage<T extends Recipe>(recipe: T): T | null {
  if (!isPositiveFinite(recipe.servings) || recipe.servings > 50) {
    return null;
  }

  const nutritionEstimate = normalizeNutritionEstimate(recipe.nutritionEstimate);
  if (!nutritionEstimate) {
    return null;
  }

  return {
    ...recipe,
    ...normalizeRecipeTime(recipe),
    nutritionEstimate,
  };
}

export function normalizeRecipeTime(
  recipe: Pick<
    Recipe,
    | 'title'
    | 'ingredients'
    | 'steps'
    | 'structuredSteps'
    | 'equipment'
    | 'prepTimeMinutes'
    | 'cookTimeMinutes'
    | 'totalTimeMinutes'
  >,
) {
  const recipeText = [
    recipe.title,
    ...(recipe.steps ?? []),
    ...(recipe.equipment ?? []),
  ].join(' ');
  const reportedPrep = getBoundedNonnegative(recipe.prepTimeMinutes);
  const reportedCook = getBoundedNonnegative(recipe.cookTimeMinutes);
  const reportedTotal = getBoundedPositive(recipe.totalTimeMinutes);
  const stepMinutes = getGuidedStepMinutes(recipe);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
  const explicitlyNoCook = NO_COOK_PATTERN.test(recipeText);
  const cookingSearchText = explicitlyNoCook ? recipeText.replace(NO_COOK_PATTERN, '') : recipeText;
  const hasCooking = COOKING_PATTERN.test(cookingSearchText) || (reportedCook ?? 0) > 0;
  const isGenuinelyNoCook = !hasCooking && explicitlyNoCook;

  if (hasCooking) {
    const minimumCook = PIZZA_PATTERN.test(recipeText) ? 12 : 5;
    const prepTimeMinutes = reportedPrep ??
      Math.max(3, Math.min(15, Math.ceil(Math.max(ingredientCount, 1) / 2)));
    const cookTimeMinutes = Math.max(reportedCook ?? 0, minimumCook);
    const totalTimeMinutes = Math.min(
      MAX_RECIPE_MINUTES,
      Math.max(reportedTotal ?? 0, prepTimeMinutes + cookTimeMinutes, stepMinutes),
    );

    return { prepTimeMinutes, cookTimeMinutes, totalTimeMinutes };
  }

  if (isGenuinelyNoCook) {
    const prepTimeMinutes = reportedPrep ??
      reportedTotal ??
      Math.max(1, Math.ceil(Math.max(ingredientCount, 1) / 3));
    const totalTimeMinutes = Math.min(
      MAX_RECIPE_MINUTES,
      Math.max(1, reportedTotal ?? 0, prepTimeMinutes, stepMinutes),
    );
    return { prepTimeMinutes, cookTimeMinutes: 0, totalTimeMinutes };
  }

  const prepTimeMinutes = reportedPrep ??
    reportedTotal ??
    Math.max(3, Math.min(30, Math.max(Math.ceil(ingredientCount / 2), stepCount * 2)));
  const totalTimeMinutes = Math.min(
    MAX_RECIPE_MINUTES,
    Math.max(1, reportedTotal ?? 0, prepTimeMinutes, stepMinutes),
  );
  return { prepTimeMinutes, cookTimeMinutes: reportedCook ?? 0, totalTimeMinutes };
}

function getGuidedStepMinutes(recipe: Pick<Recipe, 'steps' | 'structuredSteps'>) {
  const structuredMinutes = (recipe.structuredSteps ?? []).reduce((total, step) => {
    const minutes = getBoundedPositive(step.estimatedMinutes) ?? parseMinuteEstimate(step.timeEstimate);
    return total + (minutes ?? 0);
  }, 0);
  if (structuredMinutes > 0) {
    return Math.min(MAX_RECIPE_MINUTES, structuredMinutes);
  }

  return Math.min(
    MAX_RECIPE_MINUTES,
    (recipe.steps ?? []).reduce((total, step) => total + (parseMinuteEstimate(step) ?? 0), 0),
  );
}

function parseMinuteEstimate(value: string | undefined) {
  const match = value?.match(/\b(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s*(?:min|mins|minute|minutes)\b/i);
  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = match[2] ? Number(match[2]) : first;
  return getBoundedPositive(Math.round((first + second) / 2));
}

function getBoundedPositive(value: number | undefined) {
  return isPositiveFinite(value) && value <= MAX_RECIPE_MINUTES ? value : null;
}

function getBoundedNonnegative(value: number | undefined) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_RECIPE_MINUTES
    ? value
    : null;
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
