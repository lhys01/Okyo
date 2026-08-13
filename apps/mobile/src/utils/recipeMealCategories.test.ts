import assert from 'node:assert/strict';
import test from 'node:test';

import { getSavedMealCategories } from './recipeMealCategories';

const recipe = (title: string, ingredients: string[] = []) => ({
  id: title,
  scanResultId: title,
  title,
  mode: 'Normal' as const,
  description: '',
  prepTimeMinutes: 5,
  cookTimeMinutes: 10,
  servings: 2,
  difficulty: 'Easy' as const,
  estimatedHomemadeCost: 3,
  estimatedSavings: 0,
  ingredients: ingredients.map((name) => ({ name, quantity: '1' })),
  steps: [],
  substitutions: [],
  pantryNote: '',
  confidenceNote: '',
});

test('classifies stable meal categories from recipe content', () => {
  assert.deepEqual(getSavedMealCategories(recipe('Greek yogurt bowl with berries')), ['breakfast', 'lunch']);
  assert.deepEqual(getSavedMealCategories(recipe('Chocolate brownies')), ['dessert']);
  assert.deepEqual(getSavedMealCategories(recipe('Chicken wrap')), ['lunch', 'dinner']);
});

test('uses explicit metadata before keyword inference', () => {
  const tagged = { ...recipe('Chocolate breakfast muffins'), mealTypes: ['breakfast'] };
  assert.deepEqual(getSavedMealCategories(tagged), ['breakfast']);
});

test('leaves uncertain recipes uncategorized for the All bucket', () => {
  assert.deepEqual(getSavedMealCategories(recipe('A family favorite')), []);
});
