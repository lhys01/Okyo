import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanonicalRecipe } from './canonicalRecipes.js';
import type { CompletedMeal } from './completedMeals.js';
import { getHomeActivityDates, getHomeMetricOrder, isFutureDateKey, selectHomeMetrics } from './homeMetrics.js';

const now = new Date('2026-08-05T12:00:00.000Z');

test('fresh Home metrics show honest zero values, not em dashes', () => {
  const metrics = selectHomeMetrics({ completedMeals: [], now, recipesById: {}, selectedDayKey: '2026-08-05' });
  for (const metric of Object.values(metrics)) {
    assert.equal(metric.available, false);
    assert.doesNotMatch(metric.value, /—/);
    assert.doesNotMatch(metric.caption, /—/);
    for (const stat of metric.stats) assert.doesNotMatch(stat.value, /—/);
  }
  assert.equal(metrics.savings.value, '$0');
  assert.deepEqual(metrics.savings.stats.map((stat) => stat.value), ['0', '$0', '$0']);
  assert.equal(metrics.macros.value, '0');
  assert.equal(metrics.macros.caption, `calories · ${new Date(2026, 7, 5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
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
  const metrics = selectHomeMetrics({ completedMeals: [fixtureMeal(recipe)], now, recipesById: { [recipe.id]: recipe }, selectedDayKey: '2026-08-04' });
  assert.equal(metrics.savings.value, '$12.50');
  assert.equal(metrics.savings.stats[0]?.value, '1');
  assert.equal(metrics.macros.value, '520');
  assert.equal(metrics.macros.caption, `calories · ${new Date(2026, 7, 4).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
  assert.deepEqual(metrics.macros.stats.map((stat) => [stat.label, stat.value]), [['Protein', '38g'], ['Fat', '18g'], ['Carbs', '54g']]);
  assert.equal(metrics.health.value, '1');
});

test('unfinished scans and saved recipes never count toward selected-day macros', () => {
  const scanned = fixtureRecipe({ completionState: 'ready', cookingCompletedAt: undefined, id: 'scanned' });
  const saved = fixtureRecipe({ completionState: 'ready', cookingCompletedAt: undefined, id: 'saved', isSaved: true, savedAt: '2026-08-05T12:00:00.000Z' });
  const metrics = selectHomeMetrics({ completedMeals: [], now, recipesById: { saved, scanned }, selectedDayKey: '2026-08-05' });
  assert.equal(metrics.macros.value, '0');
  assert.deepEqual(metrics.macros.stats.map((stat) => stat.value), ['0g', '0g', '0g']);
});

test('two completed recipes on the selected day are summed and recipes from another day are excluded', () => {
  const first = fixtureRecipe({ cookingCompletedAt: '2026-08-05T09:00:00.000Z', id: 'first', nutritionEstimate: { calories: 400, proteinGrams: 20, carbohydratesGrams: 40, fatGrams: 10 } });
  const second = fixtureRecipe({ cookingCompletedAt: '2026-08-05T18:00:00.000Z', id: 'second', nutritionEstimate: { calories: 600, proteinGrams: 40, carbohydratesGrams: 60, fatGrams: 20 } });
  const yesterday = fixtureRecipe({ cookingCompletedAt: '2026-08-04T18:00:00.000Z', id: 'yesterday', nutritionEstimate: { calories: 900, proteinGrams: 90, carbohydratesGrams: 90, fatGrams: 90 } });
  const metrics = selectHomeMetrics({ completedMeals: [fixtureMeal(first), fixtureMeal(second), fixtureMeal(yesterday)], now, recipesById: { first, second, yesterday }, selectedDayKey: '2026-08-05' });
  assert.equal(metrics.macros.value, '1000');
  assert.deepEqual(metrics.macros.stats.map((stat) => [stat.label, stat.value]), [['Protein', '60g'], ['Fat', '30g'], ['Carbs', '100g']]);
});

test('switching between Friday and Saturday recalculates every Home total from that day alone', () => {
  const fridayAtNoon = new Date(2026, 7, 7, 12).toISOString();
  const saturdayAtNoon = new Date(2026, 7, 8, 12).toISOString();
  const firstFriday = fixtureMeal(fixtureRecipe({ id: 'friday-1', cookingCompletedAt: fridayAtNoon, estimatedSavings: 20, nutritionEstimate: { calories: 2000, proteinGrams: 50, carbohydratesGrams: 200, fatGrams: 40 }, selectedPresentationMode: 'Healthier' }));
  const secondFriday = fixtureMeal(fixtureRecipe({ id: 'friday-2', cookingCompletedAt: fridayAtNoon, estimatedSavings: 10, nutritionEstimate: { calories: 1000, proteinGrams: 25, carbohydratesGrams: 100, fatGrams: 20 } }));
  const saturday = fixtureMeal(fixtureRecipe({ id: 'saturday', cookingCompletedAt: saturdayAtNoon, estimatedSavings: 4, nutritionEstimate: { calories: 1000, proteinGrams: 12, carbohydratesGrams: 90, fatGrams: 15 } }));
  const completedMeals = [firstFriday, secondFriday, saturday];
  const input = { completedMeals, now: new Date(2026, 7, 8, 12), recipesById: {} };
  const friday = selectHomeMetrics({ ...input, selectedDayKey: '2026-08-07' });
  const saturdayMetrics = selectHomeMetrics({ ...input, selectedDayKey: '2026-08-08' });
  const fridayAgain = selectHomeMetrics({ ...input, selectedDayKey: '2026-08-07' });

  assert.equal(friday.savings.value, '$30');
  assert.deepEqual(friday.savings.stats.map((stat) => stat.value), ['2', '$15', '$30']);
  assert.equal(friday.macros.value, '3000');
  assert.deepEqual(friday.macros.stats.map((stat) => stat.value), ['75g', '60g', '300g']);
  assert.equal(friday.health.value, '1');
  assert.deepEqual(friday.health.stats.map((stat) => stat.value), ['1', '2', '1']);
  assert.equal(friday.health.progress, 0.5);

  assert.equal(saturdayMetrics.savings.value, '$4');
  assert.deepEqual(saturdayMetrics.savings.stats.map((stat) => stat.value), ['1', '$4', '$4']);
  assert.equal(saturdayMetrics.macros.value, '1000');
  assert.deepEqual(saturdayMetrics.macros.stats.map((stat) => stat.value), ['12g', '15g', '90g']);
  assert.equal(saturdayMetrics.health.value, '0');
  assert.deepEqual(saturdayMetrics.health.stats.map((stat) => stat.value), ['0', '1', '0']);
  assert.equal(saturdayMetrics.health.progress, 0);

  const fridayLabel = new Date(2026, 7, 7).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const saturdayLabel = new Date(2026, 7, 8).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  assert.match(friday.savings.caption, new RegExp(fridayLabel));
  assert.match(friday.macros.caption, new RegExp(fridayLabel));
  assert.match(friday.health.caption, new RegExp(fridayLabel));
  assert.match(saturdayMetrics.savings.caption, new RegExp(saturdayLabel));
  assert.match(saturdayMetrics.macros.caption, new RegExp(saturdayLabel));
  assert.match(saturdayMetrics.health.caption, new RegExp(saturdayLabel));
  assert.deepEqual(fridayAgain, friday);
  assert.equal(completedMeals.length, 3);
});

test('a zero-completion selected day stays at zero and missing nutrition contributes zero only for that field', () => {
  const partialNutrition = fixtureRecipe({ cookingCompletedAt: '2026-08-04T18:00:00.000Z', nutritionEstimate: { calories: 400, proteinGrams: 20, carbohydratesGrams: 40, fatGrams: undefined as unknown as number } });
  const zeroDay = selectHomeMetrics({ completedMeals: [fixtureMeal(partialNutrition)], now, recipesById: { [partialNutrition.id]: partialNutrition }, selectedDayKey: '2026-08-05' });
  assert.equal(zeroDay.macros.value, '0');
  assert.equal(zeroDay.savings.value, '$0');
  assert.deepEqual(zeroDay.savings.stats.map((stat) => stat.value), ['0', '$0', '$0']);
  assert.equal(zeroDay.health.value, '0');
  assert.deepEqual(zeroDay.health.stats.map((stat) => stat.value), ['0', '0', '0']);
  const completedDay = selectHomeMetrics({ completedMeals: [fixtureMeal(partialNutrition)], now, recipesById: { [partialNutrition.id]: partialNutrition }, selectedDayKey: '2026-08-04' });
  assert.equal(completedDay.macros.value, '400');
  assert.deepEqual(completedDay.macros.stats.map((stat) => stat.value), ['20g', '0g', '40g']);
  assert.doesNotMatch(completedDay.macros.caption, /average|averaged/i);
});

test('a historical selected day still shows its recorded meal after the calendar moves to a new month', () => {
  const historicalMeal = fixtureMeal(fixtureRecipe({
    cookingCompletedAt: new Date(2026, 6, 31, 12).toISOString(),
    estimatedSavings: 9,
    nutritionEstimate: { calories: 650, proteinGrams: 28, carbohydratesGrams: 60, fatGrams: 18 },
  }));
  const metrics = selectHomeMetrics({ completedMeals: [historicalMeal], now: new Date(2026, 7, 8, 12), recipesById: {}, selectedDayKey: '2026-07-31' });
  assert.equal(metrics.savings.value, '$9');
  assert.equal(metrics.macros.value, '650');
  assert.equal(metrics.health.stats[1]?.value, '1');
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

test('week activity retains an earlier completion when the same recipe was cooked again later', () => {
  const firstCompletion = new Date(2026, 7, 7, 12).toISOString();
  const latestCompletion = new Date(2026, 7, 8, 12).toISOString();
  const recipe = fixtureRecipe({ cookingCompletedAt: latestCompletion });
  const dates = getHomeActivityDates({ [recipe.id]: recipe }, [
    { ...fixtureMeal(recipe), id: 'first-completion', completedAt: firstCompletion },
    { ...fixtureMeal(recipe), id: 'second-completion', completedAt: latestCompletion },
  ]);
  assert.ok(dates.includes('2026-08-07'));
  assert.ok(dates.includes('2026-08-08'));
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

function fixtureMeal(recipe: CanonicalRecipe): CompletedMeal {
  return {
    id: `meal-${recipe.id}`,
    recipeId: recipe.id,
    completedAt: recipe.cookingCompletedAt ?? '2026-08-05T12:00:00.000Z',
    calories: recipe.nutritionEstimate?.calories,
    proteinGrams: recipe.nutritionEstimate?.proteinGrams,
    carbohydratesGrams: recipe.nutritionEstimate?.carbohydratesGrams,
    fatGrams: recipe.nutritionEstimate?.fatGrams,
    estimatedSavings: recipe.estimatedSavings,
    goalFriendly: recipe.selectedPresentationMode === 'Healthier' || recipe.selectedPresentationMode === 'More Protein',
  };
}
