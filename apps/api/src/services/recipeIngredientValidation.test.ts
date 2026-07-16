import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalIngredientName,
  ingredientsMatch,
} from './recipeIngredientValidation.js';

test('matches safe generic and specific ingredient aliases', () => {
  assert.equal(ingredientsMatch('2 tbsp extra-virgin olive oil', 'oil'), true);
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'olive oil'), true);
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'coconut oil'), false);
});

test('matches plurals, punctuation, quantities, and preparation words', () => {
  assert.equal(ingredientsMatch('2 large chicken breasts, finely sliced', 'chicken breast'), true);
  assert.equal(ingredientsMatch('3 tomatoes, roughly chopped', 'chopped tomato'), true);
  assert.equal(ingredientsMatch('1/2 cup green onions (thinly sliced)', 'scallion'), true);
  assert.equal(canonicalIngredientName('2 cloves garlic, minced'), 'garlic');
});

test('keeps truly different ingredients unmatched', () => {
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'butter'), false);
  assert.equal(ingredientsMatch('2 cups cooked rice', 'rice vinegar'), false);
  assert.equal(ingredientsMatch('2 cups rice', 'rice vinegar'), false);
  assert.equal(ingredientsMatch('3 tomatoes, chopped', 'tomato sauce'), false);
  assert.equal(ingredientsMatch('1 lb chicken breasts', 'chicken'), true);
});
