import assert from 'node:assert/strict';
import test from 'node:test';

import { getRecommendationById } from '../data/recommendedRecipes';
import { calculateRecipePrices, RESTAURANT_PRICE_MARKUP } from './recipePricing';

const smashCheeseburger = getRecommendationById('rec-smash-cheeseburger');
if (!smashCheeseburger) throw new Error('Smash Cheeseburger seed recipe is missing');

test('Smash Cheeseburger prices both totals locally without any network request', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (() => {
    fetchCalls += 1;
    throw new Error('Recipe pricing must not make network requests');
  }) as typeof fetch;

  try {
    assert.deepEqual(calculateRecipePrices({ recipe: smashCheeseburger }), {
      makeAtHome: 6,
      eatingOut: 18,
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('both prices scale from the same recipe estimate when servings change', () => {
  assert.deepEqual(calculateRecipePrices({ recipe: smashCheeseburger, servings: 1 }), {
    makeAtHome: 3,
    eatingOut: 9,
  });
  assert.deepEqual(calculateRecipePrices({ recipe: smashCheeseburger, servings: 4 }), {
    makeAtHome: 12,
    eatingOut: 36,
  });
  assert.equal(RESTAURANT_PRICE_MARKUP, 3);
});

test('ingredient edits that update the recipe cost update both derived prices', () => {
  const editedRecipe = {
    ...smashCheeseburger,
    ingredients: smashCheeseburger.ingredients.map((ingredient) => ingredient.name === 'ground beef (80/20)'
      ? { ...ingredient, quantity: '12 oz' }
      : ingredient),
    estimatedHomemadeCost: 7.5,
  };

  assert.deepEqual(calculateRecipePrices({ recipe: editedRecipe }), {
    makeAtHome: 7.5,
    eatingOut: 22.5,
  });
});

test('a restaurant price stays preferred, and unavailable is returned only without usable price data', () => {
  assert.deepEqual(calculateRecipePrices({ recipe: { ...smashCheeseburger, restaurantPriceEstimate: 24 } }), {
    makeAtHome: 6,
    eatingOut: 24,
  });

  const noPriceRecipe = { ...smashCheeseburger, estimatedHomemadeCost: 0 };
  assert.deepEqual(calculateRecipePrices({ recipe: noPriceRecipe }), {
    makeAtHome: null,
    eatingOut: null,
  });
});
