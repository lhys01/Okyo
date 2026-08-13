import assert from 'node:assert/strict';
import test from 'node:test';

import { scaleIngredientQuantity } from './servingScale';

test('scales common whole, fraction, and unicode quantities', () => {
  assert.equal(scaleIngredientQuantity('2 cups', 2, 4), '4 cups');
  assert.equal(scaleIngredientQuantity('1/2 cup', 2, 4), '1 cup');
  assert.equal(scaleIngredientQuantity('½ tsp', 2, 4), '1 tsp');
  assert.equal(scaleIngredientQuantity('1 ½ cups', 2, 4), '3 cups');
  assert.equal(scaleIngredientQuantity('1 1/2 cups', 2, 4), '3 cups');
  assert.equal(scaleIngredientQuantity('1 large onion', 2, 6), '3 large onion');
});

test('preserves quantities that cannot be safely parsed', () => {
  assert.equal(scaleIngredientQuantity('to taste', 2, 4), 'to taste');
  assert.equal(scaleIngredientQuantity('as needed', 2, 4), 'as needed');
  assert.equal(scaleIngredientQuantity('2–3 cloves', 2, 4), '2–3 cloves');
  assert.equal(scaleIngredientQuantity('pinch', 2, 8), 'pinch');
  assert.equal(scaleIngredientQuantity('optional', 2, 8), 'optional');
  assert.equal(scaleIngredientQuantity('juice of 1 lemon', 2, 8), 'juice of 1 lemon');
});
