import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalIngredientName,
  findMatchingIngredientName,
  ingredientsMatch,
} from './recipeIngredientValidation.js';

test('matches safe generic and specific ingredient aliases', () => {
  assert.equal(ingredientsMatch('2 tbsp extra-virgin olive oil', 'oil'), true);
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'olive oil'), true);
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'coconut oil'), false);
  assert.equal(ingredientsMatch('8 oz spaghetti', 'pasta'), true);
  assert.equal(ingredientsMatch('8 oz spaghetti', 'penne'), false);
  assert.equal(ingredientsMatch('8 oz sushi-grade salmon', 'fish'), true);
  assert.equal(ingredientsMatch('8 oz chicken breast', 'fish'), false);
  assert.equal(ingredientsMatch('1 lb sushi-grade ahi tuna', 'tuna'), true);
  assert.equal(ingredientsMatch('1 lb yellowfin tuna steaks', 'tuna'), true);
  assert.equal(ingredientsMatch('8 oz salmon', 'tuna'), false);
  assert.equal(ingredientsMatch('2 capsules fish oil', 'oil'), false);
});

test('generic oil and tuna aliases require an unambiguous canonical target', () => {
  assert.equal(
    findMatchingIngredientName('oil', ['2 tbsp extra-virgin olive oil']),
    '2 tbsp extra-virgin olive oil',
  );
  assert.equal(
    findMatchingIngredientName('tuna', ['1 lb sushi-grade ahi tuna']),
    '1 lb sushi-grade ahi tuna',
  );
  assert.equal(
    findMatchingIngredientName('oil', ['1 tbsp olive oil', '1 tsp sesame oil']),
    undefined,
  );
  assert.equal(findMatchingIngredientName('tuna', ['8 oz salmon']), undefined);
});

test('matches plurals, punctuation, quantities, and preparation words', () => {
  assert.equal(ingredientsMatch('2 large chicken breasts, finely sliced', 'chicken breast'), true);
  assert.equal(ingredientsMatch('3 tomatoes, roughly chopped', 'chopped tomato'), true);
  assert.equal(ingredientsMatch('1/2 cup green onions (thinly sliced)', 'scallion'), true);
  assert.equal(ingredientsMatch('1 avocado', 'avocado'), true);
  assert.equal(canonicalIngredientName('2 cloves garlic, minced'), 'garlic');
});

test('keeps truly different ingredients unmatched', () => {
  assert.equal(ingredientsMatch('1 tbsp olive oil', 'butter'), false);
  assert.equal(ingredientsMatch('2 cups cooked rice', 'rice vinegar'), false);
  assert.equal(ingredientsMatch('2 cups rice', 'rice vinegar'), false);
  assert.equal(ingredientsMatch('3 tomatoes, chopped', 'tomato sauce'), false);
  assert.equal(ingredientsMatch('1 lb chicken breasts', 'chicken'), true);
});
