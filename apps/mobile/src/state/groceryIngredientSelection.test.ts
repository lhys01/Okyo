import assert from 'node:assert/strict';
import test from 'node:test';

import { toggleGroceryIngredientSelection } from './groceryIngredientSelection';

const ingredients = [
  { name: 'Beef patty', quantity: '1' },
  { name: 'Burger bun', quantity: '1' },
];

test('an individual grocery selection adds, then removes, the same ingredient', () => {
  const added = toggleGroceryIngredientSelection({ groceryIngredientSelections: {}, groceryRecipeIds: [] }, 'burger', 'Beef patty', ingredients);
  assert.deepEqual(added.groceryRecipeIds, ['burger']);
  assert.deepEqual(added.groceryIngredientSelections.burger, ['beef patty']);

  const removed = toggleGroceryIngredientSelection(added, 'burger', 'Beef patty', ingredients);
  assert.deepEqual(removed.groceryRecipeIds, []);
  assert.deepEqual(removed.groceryIngredientSelections, {});
});

test('removing one ingredient from a bulk grocery recipe retains the other ingredients', () => {
  const next = toggleGroceryIngredientSelection({ groceryIngredientSelections: {}, groceryRecipeIds: ['burger'] }, 'burger', 'Beef patty', ingredients);
  assert.deepEqual(next.groceryRecipeIds, ['burger']);
  assert.deepEqual(next.groceryIngredientSelections.burger, ['burger bun']);
});
