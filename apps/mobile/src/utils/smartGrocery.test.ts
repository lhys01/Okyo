import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { buildSmartGrocerySummary } from './smartGrocery';

function createRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-test',
    scanResultId: 'scan-test',
    title: 'Test Bowl',
    mode: 'Restaurant Copy',
    description: 'Test recipe.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 5,
    estimatedSavings: 0,
    ingredients: [{ name: 'rice', quantity: '1 cup' }],
    steps: ['Cook the rice.'],
    substitutions: [],
    pantryNote: '',
    confidenceNote: '',
    ...overrides,
  };
}

test('real scan grocery summaries do not fall back to recipe ingredients', () => {
  const summary = buildSmartGrocerySummary(createRecipe(), { allowIngredientFallback: false });
  assert.equal(summary.needToBuy.length, 0);
  assert.equal(summary.probablyHave.length, 0);
  assert.equal(summary.optional.length, 0);
});

test('validated server grocery items remain available when fallback is disabled', () => {
  const summary = buildSmartGrocerySummary(createRecipe({
    groceryItems: [{ name: 'rice', quantity: '1 bag', category: 'Noodles / Grains' }],
  }), { allowIngredientFallback: false });
  assert.equal(summary.needToBuy.length, 1);
  assert.equal(summary.needToBuy[0].name, 'rice');
});

test('invalid server grocery items do not become a successful real-scan list', () => {
  const summary = buildSmartGrocerySummary(createRecipe({
    groceryItems: [{ name: 'lobster', quantity: '1 whole', category: 'Protein' }],
  }), { allowIngredientFallback: false });
  assert.equal(summary.needToBuy.length, 0);
  assert.equal(summary.probablyHave.length, 0);
  assert.equal(summary.optional.length, 0);
});

test('editorial recipes may retain ingredient-derived grocery summaries', () => {
  const summary = buildSmartGrocerySummary(createRecipe(), { allowIngredientFallback: true });
  assert.equal(summary.needToBuy.length, 1);
  assert.equal(summary.needToBuy[0].name, 'rice');
});
