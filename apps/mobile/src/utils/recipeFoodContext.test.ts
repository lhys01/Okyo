import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { getRecipeFoodContext } from './recipeFoodContext';

function recipeWith(names: string[]): Recipe {
  return {
    id: 'test', scanResultId: 'scan-test', mode: 'Restaurant Copy', title: 'Test recipe', description: '', difficulty: 'Easy', servings: 2,
    prepTimeMinutes: 5, cookTimeMinutes: 10, estimatedHomemadeCost: 4, estimatedSavings: 0,
    ingredients: names.map((name) => ({ name, quantity: '1', unit: '' })), steps: [], substitutions: [],
    pantryNote: '', confidenceNote: '',
  };
}

test('derives food groups and allergen checks from listed ingredients', () => {
  const context = getRecipeFoodContext(recipeWith(['penne pasta', 'parmesan cheese', 'tomatoes', 'fresh basil']));
  assert.match(context.summary, /grain or starchy base/);
  assert.match(context.summary, /vegetables or herbs/);
  assert.deepEqual(context.allergens, ['dairy', 'wheat/gluten']);
});

test('does not infer allergens from partial words', () => {
  const context = getRecipeFoodContext(recipeWith(['eggplant', 'soy-free seasoning']));
  assert.deepEqual(context.allergens, []);
  assert.doesNotMatch(context.allergens.join(' '), /egg/);
});

test('uses cautious fallback copy for an unclassified ingredient list', () => {
  const context = getRecipeFoodContext(recipeWith(['seasoning blend']));
  assert.match(context.summary, /ingredient list is the best guide/i);
  assert.match(context.disclaimer, /brands.*substitutions/i);
});
