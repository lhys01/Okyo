import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { normalizeRecipeForCanonicalStorage, normalizeRecipeTime } from './recipeIntegrity';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-fixture',
    scanResultId: 'scan-fixture',
    title: 'Skillet Dinner',
    mode: 'Normal',
    description: 'An estimated homemade recipe.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 8,
    estimatedSavings: 12,
    ingredients: [{ name: 'vegetables', quantity: '2 cups' }],
    steps: ['Cook the vegetables in a skillet for 20 minutes.'],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated.',
    nutritionEstimate: {
      calories: 500,
      proteinGrams: 25,
      carbohydratesGrams: 55,
      fatGrams: 20,
    },
    ...overrides,
  };
}

test('a cooked pizza reported as one minute is normalized to a credible content-based total', () => {
  const time = normalizeRecipeTime(makeRecipe({
    title: 'Baked Vegetable Pizza',
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
    steps: ['Bake the pizza until the crust is browned.'],
  }));

  assert.ok(time.cookTimeMinutes >= 12);
  assert.ok(time.totalTimeMinutes >= 13);
});

test('a normal cooked meal keeps its valid reported time', () => {
  assert.deepEqual(normalizeRecipeTime(makeRecipe()), {
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
  });
});

test('a genuinely quick no-cook snack can remain one minute', () => {
  assert.deepEqual(normalizeRecipeTime(makeRecipe({
    title: 'No-cook Snack Plate',
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
    steps: ['Arrange the fruit and yogurt on a plate.'],
  })), {
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
  });
});

test('malformed or missing time receives a finite positive content-based fallback', () => {
  const time = normalizeRecipeTime(makeRecipe({
    prepTimeMinutes: Number.NaN,
    cookTimeMinutes: Number.POSITIVE_INFINITY,
    totalTimeMinutes: undefined,
    steps: ['Combine the ingredients.', 'Arrange on a plate.'],
  }));

  assert.ok(Number.isFinite(time.totalTimeMinutes));
  assert.ok(time.totalTimeMinutes > 0);
});

test('canonical normalization rejects invalid servings and nutrition and reconciles calorie disagreement', () => {
  assert.equal(normalizeRecipeForCanonicalStorage(makeRecipe({ servings: 0 })), null);
  assert.equal(normalizeRecipeForCanonicalStorage(makeRecipe({
    nutritionEstimate: {
      calories: 500,
      proteinGrams: -1,
      carbohydratesGrams: 20,
      fatGrams: 10,
    },
  })), null);

  const normalized = normalizeRecipeForCanonicalStorage(makeRecipe({
    nutritionEstimate: {
      calories: 1400,
      proteinGrams: 30,
      carbohydratesGrams: 40,
      fatGrams: 20,
    },
  }));
  assert.equal(normalized?.nutritionEstimate?.calories, 460);
});
