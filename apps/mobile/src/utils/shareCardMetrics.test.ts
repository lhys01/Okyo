import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { getMetricRows, getShareMetrics } from './shareCardMetrics';
import { getNormalizedRecipeDifficulty } from './recipeIntegrity';

const recipe: Recipe = {
  id: 'recipe-1', scanResultId: 'scan-1', title: 'Current recipe', mode: 'More Protein', description: 'A current recipe.',
  prepTimeMinutes: 13, cookTimeMinutes: 24, totalTimeMinutes: 37, servings: 2, difficulty: 'Medium', estimatedHomemadeCost: 8, estimatedSavings: 12,
  ingredients: [], steps: ['one', 'two', 'three'], substitutions: [], pantryNote: '', confidenceNote: '',
  nutritionEstimate: { calories: 582, proteinGrams: 14, carbohydratesGrams: 43, fatGrams: 21 },
};

test('share metrics read nutrition from the current recipe revision', () => {
  const initial = getShareMetrics(recipe, 2);
  assert.equal(initial.find((metric) => metric.key === 'protein')?.value, '14g');
  const updated = getShareMetrics({ ...recipe, nutritionEstimate: { ...recipe.nutritionEstimate!, proteinGrams: 27 } }, 2);
  assert.equal(updated.find((metric) => metric.key === 'protein')?.value, '27g');
});

test('serving display follows the active override while nutrition remains per serving', () => {
  const metrics = getShareMetrics(recipe, 4);
  assert.equal(metrics.find((metric) => metric.key === 'servings')?.value, '4 servings');
  assert.equal(metrics.find((metric) => metric.key === 'protein')?.value, '14g');
});

test('metric rows are balanced deterministically from zero through nine fields', () => {
  const keys = Array.from({ length: 9 }, (_, index) => index + 1);
  const shapes = keys.map((_, count) => getMetricRows(keys.slice(0, count)).map((row) => row.length));
  assert.deepEqual(shapes, [[], [1], [2], [3], [2, 2], [3, 2], [3, 3], [3, 2, 2], [3, 3, 2]]);
});

test('difficulty reserves Easy for genuinely simple recipes', () => {
  assert.equal(getNormalizedRecipeDifficulty(recipe), 'Medium');
  assert.equal(getNormalizedRecipeDifficulty({ ...recipe, difficulty: 'Easy', ingredients: recipe.ingredients.slice(0, 4), steps: ['Toast bread.', 'Serve.'], totalTimeMinutes: 8 }), 'Easy');
  assert.equal(getNormalizedRecipeDifficulty({ ...recipe, difficulty: 'Easy', steps: Array.from({ length: 10 }, () => 'Cook the component.'), totalTimeMinutes: 60 }), 'Hard');
});
