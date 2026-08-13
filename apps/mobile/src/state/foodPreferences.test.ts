import assert from 'node:assert/strict';
import test from 'node:test';

import { createFoodPreferencesPersistence, findFoodPreferenceConflicts, normalizeFoodPreferences, toApiFoodPreferences } from './foodPreferences';

test('legacy dietary state migrates into risk-aware categories', () => {
  assert.deepEqual(normalizeFoodPreferences({ restrictions: ['Shellfish allergy', 'Vegetarian'], dislikes: ['Mushrooms'] }), {
    allergies: ['Shellfish'], restrictions: ['Vegetarian'], avoidances: [], dislikes: ['Mushrooms'],
  });
});

test('API mapping keeps allergies and restrictions hard while avoids and dislikes stay soft', () => {
  assert.deepEqual(toApiFoodPreferences({ allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: ['Pork'], dislikes: ['Olives'] }), {
    dietaryRestrictions: ['Peanuts', 'Vegan'], dietaryDislikes: ['Pork', 'Olives'],
  });
});

test('allergy conflicts are stronger than ordinary dislikes', () => {
  const conflicts = findFoodPreferenceConflicts(['grilled shrimp', 'mushrooms'], { allergies: ['Shellfish'], restrictions: [], avoidances: [], dislikes: ['Mushrooms'] });
  assert.equal(conflicts.find((item) => item.preference === 'Shellfish')?.category, 'allergy');
  assert.equal(conflicts.find((item) => item.preference === 'Mushrooms')?.category, 'dislike');
});

test('preferences persist and clear through one source of truth', async () => {
  const values = new Map<string, string>();
  const persistence = createFoodPreferencesPersistence({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  });
  await persistence.write({ allergies: ['Eggs'], restrictions: [], avoidances: [], dislikes: [] });
  assert.deepEqual((await persistence.read()).allergies, ['Eggs']);
  await persistence.clear();
  assert.deepEqual(await persistence.read(), { allergies: [], restrictions: [], avoidances: [], dislikes: [] });
});
