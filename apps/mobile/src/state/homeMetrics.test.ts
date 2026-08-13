import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanonicalRecipe } from './canonicalRecipes.js';
import { getHomeActivityDates, getHomeMetricOrder, isFutureDateKey, selectHomeMetrics } from './homeMetrics.js';

const now = new Date('2026-08-05T12:00:00.000Z');

test('fresh Home metrics show honest zero values, not em dashes', () => {
  const metrics = selectHomeMetrics({ completedChallenges: [], now, recipesById: {}, selectedDayKey: '2026-08-05', totalMoneySaved: 0 });
  for (const metric of Object.values(metrics)) {
    assert.equal(metric.available, false);
    assert.doesNotMatch(metric.value, /—/);
    assert.doesNotMatch(metric.caption, /—/);
    for (const stat of metric.stats) assert.doesNotMatch(stat.value, /—/);
  }
  assert.equal(metrics.savings.value, '$0');
  assert.deepEqual(metrics.savings.stats.map((stat) => stat.value), ['0', '$0', '$0']);
  assert.equal(metrics.macros.value, '0');
  assert.equal(metrics.macros.caption, 'calories today');
  assert.deepEqual(metrics.macros.stats.map((stat) => stat.value), ['0g', '0g', '0g']);
  assert.deepEqual(metrics.macros.stats.map((stat) => stat.label), ['Protein', 'Fat', 'Carbs']);
  assert.equal(metrics.health.value, '0');
  assert.deepEqual(metrics.health.stats.map((stat) => stat.value), ['0', '0', '0']);
  for (const metric of [metrics.savings, metrics.health]) {
    assert.equal(metric.caption, 'Cook a meal to see this. Your totals will appear here.');
    assert.doesNotMatch(metric.accessibilityLabel, /NaN/);
  }
  assert.deepEqual(metrics.health.stats.map((stat) => stat.label), ['healthier edits', 'meals cooked', 'goal-friendly meals']);
});

test('future date detection uses local calendar days', () => {
  const lateLocalToday = new Date(2026, 7, 10, 23, 59, 59);
  assert.equal(isFutureDateKey('2026-08-10', lateLocalToday), false);
  assert.equal(isFutureDateKey('2026-08-11', lateLocalToday), true);
  assert.equal(isFutureDateKey('2026-08-17', lateLocalToday), true);
  assert.equal(isFutureDateKey('2026-08-09', lateLocalToday), false);
  assert.equal(isFutureDateKey('2026-09-01', new Date(2026, 7, 31, 23, 59, 59)), true);
  assert.equal(isFutureDateKey('2027-01-01', new Date(2026, 11, 31, 23, 59, 59)), true);
});

test('a completed recipe contributes its full nutrition totals on the completed day', () => {
  const recipe = fixtureRecipe({
    cookingCompletedAt: '2026-08-04T12:00:00.000Z',
    estimatedSavings: 12.5,
    nutritionEstimate: { calories: 520, proteinGrams: 38, carbohydratesGrams: 54, fatGrams: 18 },
    selectedPresentationMode: 'Healthier',
  });
  const metrics = selectHomeMetrics({ completedChallenges: [], now, recipesById: { [recipe.id]: recipe }, selectedDayKey: '2026-08-04', totalMoneySaved: 0 });
  assert.equal(metrics.savings.value, '$12.50');
  assert.equal(metrics.savings.stats[0]?.value, '1');
  assert.equal(metrics.macros.value, '520');
  assert.equal(metrics.macros.caption, 'calories today');
  assert.deepEqual(metrics.macros.stats.map((stat) => [stat.label, stat.value]), [['Protein', '38g'], ['Fat', '18g'], ['Carbs', '54g']]);
  assert.equal(metrics.health.value, '1');
});

test('unfinished scans and saved recipes never count toward selected-day macros', () => {
  const scanned = fixtureRecipe({ completionState: 'ready', cookingCompletedAt: undefined, id: 'scanned' });
  const saved = fixtureRecipe({ completionState: 'ready', cookingCompletedAt: undefined, id: 'saved', isSaved: true, savedAt: '2026-08-05T12:00:00.000Z' });
  const metrics = selectHomeMetrics({ completedChallenges: [], now, recipesById: { saved, scanned }, selectedDayKey: '2026-08-05', totalMoneySaved: 0 });
  assert.equal(metrics.macros.value, '0');
  assert.deepEqual(metrics.macros.stats.map((stat) => stat.value), ['0g', '0g', '0g']);
});

test('two completed recipes on the selected day are summed and recipes from another day are excluded', () => {
  const first = fixtureRecipe({ cookingCompletedAt: '2026-08-05T09:00:00.000Z', id: 'first', nutritionEstimate: { calories: 400, proteinGrams: 20, carbohydratesGrams: 40, fatGrams: 10 } });
  const second = fixtureRecipe({ cookingCompletedAt: '2026-08-05T18:00:00.000Z', id: 'second', nutritionEstimate: { calories: 600, proteinGrams: 40, carbohydratesGrams: 60, fatGrams: 20 } });
  const yesterday = fixtureRecipe({ cookingCompletedAt: '2026-08-04T18:00:00.000Z', id: 'yesterday', nutritionEstimate: { calories: 900, proteinGrams: 90, carbohydratesGrams: 90, fatGrams: 90 } });
  const metrics = selectHomeMetrics({ completedChallenges: [], now, recipesById: { first, second, yesterday }, selectedDayKey: '2026-08-05', totalMoneySaved: 0 });
  assert.equal(metrics.macros.value, '1000');
  assert.deepEqual(metrics.macros.stats.map((stat) => [stat.label, stat.value]), [['Protein', '60g'], ['Fat', '30g'], ['Carbs', '100g']]);
});

test('a zero-completion selected day stays at zero and missing nutrition contributes zero only for that field', () => {
  const partialNutrition = fixtureRecipe({ cookingCompletedAt: '2026-08-04T18:00:00.000Z', nutritionEstimate: { calories: 400, proteinGrams: 20, carbohydratesGrams: 40, fatGrams: undefined as unknown as number } });
  const zeroDay = selectHomeMetrics({ completedChallenges: [], now, recipesById: { [partialNutrition.id]: partialNutrition }, selectedDayKey: '2026-08-05', totalMoneySaved: 0 });
  assert.equal(zeroDay.macros.value, '0');
  const completedDay = selectHomeMetrics({ completedChallenges: [], now, recipesById: { [partialNutrition.id]: partialNutrition }, selectedDayKey: '2026-08-04', totalMoneySaved: 0 });
  assert.equal(completedDay.macros.value, '400');
  assert.deepEqual(completedDay.macros.stats.map((stat) => stat.value), ['20g', '0g', '40g']);
  assert.doesNotMatch(completedDay.macros.caption, /average|averaged/i);
});

test('carousel order follows the three primary profiles and defaults to savings', () => {
  assert.deepEqual(getHomeMetricOrder('save_money'), ['savings', 'macros']);
  assert.deepEqual(getHomeMetricOrder('hit_macros'), ['macros', 'savings']);
  assert.deepEqual(getHomeMetricOrder('eat_healthier'), ['savings', 'macros']);
  assert.deepEqual(getHomeMetricOrder(null), ['savings', 'macros']);
});

test('week activity includes only real scan, saved, or cooked recipe dates', () => {
  const recipe = fixtureRecipe({ cookingCompletedAt: '2026-08-04T12:00:00.000Z', savedAt: '2026-08-05T12:00:00.000Z' });
  assert.deepEqual(getHomeActivityDates({ [recipe.id]: recipe }), ['2026-08-01', '2026-08-04', '2026-08-05']);
});

function fixtureRecipe(overrides: Partial<CanonicalRecipe> = {}): CanonicalRecipe {
  return {
    id: 'recipe', recipeId: 'recipe', sourceRecipeId: 'recipe', scanResultId: 'scan', origin: 'scan', originalImage: null,
    detectedDishName: 'Dish', correctedDishName: null, selectedMode: 'Normal', selectedPresentationMode: 'Normal', completionState: 'completed',
    isSaved: true, createdAt: '2026-08-01T12:00:00.000Z', scanCompletedAt: '2026-08-01T12:00:00.000Z', savedAt: '2026-08-01T12:00:00.000Z',
    scanResult: null, title: 'Dish', mode: 'Normal', description: 'A dish.', prepTimeMinutes: 10, cookTimeMinutes: 20, servings: 2,
    difficulty: 'Easy', estimatedHomemadeCost: 6, estimatedSavings: 0, ingredients: [], steps: [], substitutions: [], pantryNote: '', confidenceNote: '',
    ...overrides,
  };
}
