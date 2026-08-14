import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActiveCookingSession } from './activeCooking.js';
import type { CanonicalRecipe } from './canonicalRecipes.js';
import { createCompletedMeal, migrateLegacyCompletedMeals, sanitizeCompletedMeals } from './completedMeals.js';

test('completed meal snapshots calculate estimated savings as Eating out minus make at home', () => {
  const meal = createCompletedMeal(recipe(), session());
  assert.equal(meal.eatingOutEstimate, 20);
  assert.equal(meal.makeAtHomeCost, 6);
  assert.equal(meal.estimatedSavings, 14);
});

test('a cooking session has one completion id while a later session can record the same recipe again', () => {
  const first = createCompletedMeal(recipe(), session());
  const repeatedCompletion = createCompletedMeal(recipe(), session(), '2026-08-05T12:01:00.000Z');
  const laterSession = createCompletedMeal(recipe(), { ...session(), startedAt: '2026-08-06T11:00:00.000Z' });
  assert.equal(first.id, repeatedCompletion.id);
  assert.notEqual(first.id, laterSession.id);
});

test('completed meal sanitization rejects malformed records and recalculates rather than trusting persisted savings', () => {
  const meals = sanitizeCompletedMeals([
    { id: 'valid', recipeId: 'recipe', completedAt: '2026-08-05T12:00:00.000Z', makeAtHomeCost: 6, eatingOutEstimate: 20, estimatedSavings: 999, goalFriendly: true },
    { id: 'bad-date', recipeId: 'recipe', completedAt: 'not-a-date', estimatedSavings: 50 },
    { id: 'valid', recipeId: 'duplicate', completedAt: '2026-08-05T12:00:00.000Z', estimatedSavings: 50 },
  ]);
  assert.equal(meals.length, 1);
  assert.equal(meals[0]?.estimatedSavings, 14);
});

test('legacy migration includes only recipes explicitly marked completed', () => {
  const completed = recipe();
  const scannedOnly = recipe({ id: 'scan-only', recipeId: 'scan-only', completionState: 'ready', cookingCompletedAt: undefined });
  const meals = migrateLegacyCompletedMeals({ [completed.id]: completed, [scannedOnly.id]: scannedOnly });
  assert.deepEqual(meals.map((meal) => meal.recipeId), [completed.id]);
});

function recipe(overrides: Partial<CanonicalRecipe> = {}): CanonicalRecipe {
  return {
    id: 'recipe', recipeId: 'recipe', sourceRecipeId: 'source', scanResultId: 'scan', origin: 'scan', originalImage: null,
    detectedDishName: 'Dish', correctedDishName: null, selectedMode: 'Normal', selectedPresentationMode: 'Healthier', completionState: 'completed',
    isSaved: false, createdAt: '2026-08-05T10:00:00.000Z', scanCompletedAt: '2026-08-05T10:00:00.000Z', cookingCompletedAt: '2026-08-05T12:00:00.000Z',
    scanResult: null, title: 'Dish', mode: 'Normal', description: 'A dish.', prepTimeMinutes: 10, cookTimeMinutes: 20, servings: 2,
    difficulty: 'Easy', estimatedHomemadeCost: 6, restaurantPriceEstimate: 20, estimatedSavings: 999,
    nutritionEstimate: { calories: 500, proteinGrams: 30, carbohydratesGrams: 50, fatGrams: 15 },
    ingredients: [], steps: [], substitutions: [], pantryNote: '', confidenceNote: '',
    ...overrides,
  };
}

function session(): ActiveCookingSession {
  return { recipeId: 'recipe', recipeRevisionId: 'source', currentStepIndex: 2, totalStepCount: 3, startedAt: '2026-08-05T11:00:00.000Z', lastUpdatedAt: '2026-08-05T12:00:00.000Z', completionStatus: 'active' };
}
