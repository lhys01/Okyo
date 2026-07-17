import assert from 'node:assert/strict';
import test from 'node:test';

import { recipeCheckRecipeSchema } from './recipeInput.js';

test('accepts a small flexible recipe', () => {
  const result = recipeCheckRecipeSchema.safeParse({
    title: 'Weeknight noodles',
    ingredients: [{ name: 'noodles', quantity: '8 oz' }],
    steps: ['Boil the noodles.'],
    customClientField: true,
  });
  assert.equal(result.success, true);
});

test('rejects empty recipe-shaped objects', () => {
  const result = recipeCheckRecipeSchema.safeParse({ metadata: 'not a recipe' });
  assert.equal(result.success, false);
});

test('rejects oversized recipe arrays', () => {
  const result = recipeCheckRecipeSchema.safeParse({
    title: 'Too many steps',
    steps: Array.from({ length: 251 }, (_, index) => `Step ${index}`),
  });
  assert.equal(result.success, false);
});

test('rejects oversized nested recipe payloads', () => {
  const result = recipeCheckRecipeSchema.safeParse({
    title: 'Oversized recipe',
    steps: ['Cook it.'],
    notes: 'x'.repeat(250_001),
  });
  assert.equal(result.success, false);
});
