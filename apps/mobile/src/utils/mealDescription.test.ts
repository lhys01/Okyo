import assert from 'node:assert/strict';
import test from 'node:test';

import { validateMealDescription } from './mealDescription';

test('written-meal input rejects empty and whitespace-only text', () => {
  assert.equal(validateMealDescription(''), 'Tell Okyo a little about the meal first.');
  assert.equal(validateMealDescription('   '), 'Tell Okyo a little about the meal first.');
});

test('written-meal input accepts a concise meal description', () => {
  assert.equal(validateMealDescription('A crispy chicken sandwich with spicy sauce'), null);
});
