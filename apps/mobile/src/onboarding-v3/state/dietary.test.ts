import assert from 'node:assert/strict';
import test from 'node:test';

import { onboardingV3Reducer, initialOnboardingV3State } from '../controller/onboardingV3Machine';
import { DIETARY_DISLIKES, DIETARY_RESTRICTIONS, normalizeDietarySelection } from './dietary';

test('dietary catalogs contain the exact hard and soft choices', () => {
  assert.deepEqual(DIETARY_RESTRICTIONS, [
    'Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten', 'Shellfish',
    'Fish', 'Soy', 'Sesame', 'Pork', 'Beef', 'Alcohol',
  ]);
  assert.deepEqual(DIETARY_DISLIKES, [
    'Mushrooms', 'Olives', 'Cilantro', 'Spicy food', 'Onions', 'Seafood', 'Very sweet',
  ]);
});

test('dietary serialization trims, deduplicates, and keeps hard and soft values separate', () => {
  assert.deepEqual(normalizeDietarySelection({
    restrictions: [' Dairy ', 'Dairy', '', 4],
    dislikes: ['Olives', ' Olives ', 'Cilantro'],
  }), {
    allergies: [],
    restrictions: ['Dairy'],
    avoidances: [],
    dislikes: ['Olives', 'Cilantro'],
  });
});

test('Continue with an empty dietary selection is valid', () => {
  const state = onboardingV3Reducer({
    ...initialOnboardingV3State,
    step: 'dietaryPreferences',
  }, { type: 'DIETARY_SET', preferences: { allergies: [], restrictions: [], avoidances: [], dislikes: [] } });
  assert.equal(state.step, 'planReady');
  assert.deepEqual(state.dietaryRestrictions, []);
  assert.deepEqual(state.profile.dietaryRestrictions, []);
});
