import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { consolidateRecipeIngredients, normalizeIngredientName } from './groceryConsolidation';

const recipe = (id: string, ingredients: Recipe['ingredients']): Recipe => ({
  id, scanResultId: id, title: `Recipe ${id}`, mode: 'Restaurant Copy', description: '',
  prepTimeMinutes: 1, cookTimeMinutes: 1, servings: 1, difficulty: 'Easy',
  ingredients, steps: ['Cook.'],
  substitutions: [], pantryNote: '', confidenceNote: '',
});

test('merges spelling variants and compatible quantities with recipe traceability', () => {
  const items = consolidateRecipeIngredients([
    recipe('a', [{ name: 'Eggs', quantity: '2' }]),
    recipe('b', [{ name: 'egg', quantity: '3' }]),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, '5');
  assert.deepEqual(items[0].sources.map((source) => source.recipeId), ['a', 'b']);
});

test('keeps incompatible units separate', () => {
  const items = consolidateRecipeIngredients([
    recipe('a', [{ name: 'flour', quantity: '1 cup' }]),
    recipe('b', [{ name: 'flour', quantity: '200 g' }]),
  ]);
  assert.equal(items.length, 2);
});

test('does not merge meaningfully different descriptive ingredients', () => {
  const items = consolidateRecipeIngredients([
    recipe('a', [{ name: 'red onion', quantity: '1' }, { name: 'fresh basil', quantity: '1 cup' }]),
    recipe('b', [{ name: 'yellow onion', quantity: '1' }, { name: 'dried basil', quantity: '1 cup' }]),
  ]);
  assert.equal(items.length, 4);
});

test('normalizes punctuation, whitespace, accents, and conservative plurals', () => {
  assert.equal(normalizeIngredientName('  TOMATOES,  '), 'tomato');
  assert.equal(normalizeIngredientName('Crème fraîche'), 'creme fraiche');
});

test('recomputes the list when a recipe is removed, edited, or deleted', () => {
  const first = recipe('a', [{ name: 'eggs', quantity: '2' }]);
  const second = recipe('b', [{ name: 'egg', quantity: '3' }]);
  const combined = consolidateRecipeIngredients([first, second]);
  assert.equal(combined[0].quantity, '5');

  const afterRemoval = consolidateRecipeIngredients([first]);
  assert.equal(afterRemoval[0].quantity, '2');
  assert.deepEqual(afterRemoval[0].sources.map((source) => source.recipeId), ['a']);

  const edited = recipe('a', [{ name: 'eggs', quantity: '4' }]);
  assert.equal(consolidateRecipeIngredients([edited])[0].quantity, '4');
  assert.deepEqual(consolidateRecipeIngredients([]), []);
});

test('keeps a stable item id so checked state survives compatible recipe changes', () => {
  const original = consolidateRecipeIngredients([recipe('a', [{ name: 'Eggs', quantity: '2' }])]);
  const checkedIds = new Set([original[0].id]);
  const updated = consolidateRecipeIngredients([
    recipe('a', [{ name: 'egg', quantity: '2' }]),
    recipe('b', [{ name: 'eggs', quantity: '3' }]),
  ]);

  assert.equal(updated[0].quantity, '5');
  assert.equal(checkedIds.has(updated[0].id), true);
});
