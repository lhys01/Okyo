import assert from 'node:assert/strict';
import test from 'node:test';

import { isGenuinePlatterMeal } from './recipePlatterValidation.js';

test('recognizes explicit multi-component platter meals', () => {
  for (const dishName of ['Sushi Platter', 'Chicken Bento', 'Mezze Assortment', 'Vegetable Thali']) {
    assert.equal(isGenuinePlatterMeal({ dishName, broadDishCategory: 'restaurant meal' }), true);
  }
  assert.equal(isGenuinePlatterMeal({
    dishName: 'Chef Selection',
    broadDishCategory: 'mixed platter',
  }), true);
});

test('does not treat an ordinary dish as a platter because it has several ingredients', () => {
  assert.equal(isGenuinePlatterMeal({
    dishName: 'Chicken Teriyaki Rice Bowl',
    broadDishCategory: 'rice bowl',
  }), false);
  assert.equal(isGenuinePlatterMeal({
    dishName: 'California Roll',
    broadDishCategory: 'sushi',
  }), false);
});
