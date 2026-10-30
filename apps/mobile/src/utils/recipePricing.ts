import type { Recipe } from '../mocks';

/** Restaurant menu prices are estimated at 3× ingredient cost (roughly a 33% food-cost share). */
export const RESTAURANT_PRICE_MARKUP = 3;

export type RecipePrices = {
  makeAtHome: number | null;
  eatingOut: number | null;
};

/** Calculate comparable totals for the selected serving count using only recipe/local price data. */
export function calculateRecipePrices({
  recipe,
  restaurantPrice,
  homemadePrice,
  servings = recipe.servings,
}: {
  recipe: Recipe;
  restaurantPrice?: number;
  homemadePrice?: number;
  servings?: number;
}): RecipePrices {
  const recipeHomeCost = isKnownPrice(recipe.estimatedHomemadeCost) ? recipe.estimatedHomemadeCost : null;
  const baseHomeCost = recipeHomeCost ?? (isKnownPrice(homemadePrice) ? homemadePrice : null);
  const makeAtHome = baseHomeCost === null
    ? null
    : recipeHomeCost !== null && isKnownPrice(recipe.servings)
      ? scalePrice(baseHomeCost, servings, recipe.servings)
      : baseHomeCost;

  const explicitRestaurantPrice = isKnownPrice(recipe.restaurantPriceEstimate)
    ? recipe.restaurantPriceEstimate
    : isKnownPrice(restaurantPrice)
      ? restaurantPrice
      // Older scanned recipes stored the difference as estimatedSavings.
      : recipeHomeCost !== null && isKnownPrice(recipe.estimatedSavings)
        ? recipeHomeCost + recipe.estimatedSavings
        : null;

  const eatingOut = explicitRestaurantPrice !== null
    ? isKnownPrice(recipe.servings)
      ? scalePrice(explicitRestaurantPrice, servings, recipe.servings)
      : explicitRestaurantPrice
    : makeAtHome === null
      ? null
      : roundCurrency(makeAtHome * RESTAURANT_PRICE_MARKUP);

  return { makeAtHome, eatingOut };
}

function scalePrice(total: number, servings: number, originalServings: number): number {
  return roundCurrency((total / originalServings) * servings);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isKnownPrice(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
