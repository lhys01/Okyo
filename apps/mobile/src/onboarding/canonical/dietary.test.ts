import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalDietaryHandoff } from './dietary';

test('canonical dietary handoff preserves the four food-safety categories', () => {
  const handoff = createCanonicalDietaryHandoff({
    allergies: ['Peanuts', 'Peanuts'], restrictions: ['Vegan'], avoidances: ['Pork'], dislikes: ['Olives'],
  });
  assert.deepEqual(handoff.preferences, { allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: ['Pork'], dislikes: ['Olives'] });
  assert.deepEqual(handoff.dietaryRestrictions, ['Peanuts', 'Vegan']);
  assert.deepEqual(handoff.dietaryDislikes, ['Pork', 'Olives']);
});
