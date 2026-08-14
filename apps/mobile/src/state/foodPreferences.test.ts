import assert from 'node:assert/strict';
import test from 'node:test';

import { createFoodPreferencesPersistence, findFoodPreferenceConflicts, normalizeFoodPreferences, toApiFoodPreferences } from './foodPreferences';

test('legacy dietary state migrates into risk-aware categories', () => {
  assert.deepEqual(normalizeFoodPreferences({ restrictions: ['Shellfish allergy', 'Vegetarian'], dislikes: ['Mushrooms'] }), {
    allergies: ['Shellfish'], restrictions: ['Vegetarian'], avoidances: [], dislikes: ['Mushrooms'],
  });
});

test('API mapping sends allergies, restrictions, and dislikes as three separate fields (Step 06: never merged into one ambiguous list)', () => {
  assert.deepEqual(toApiFoodPreferences({ allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: ['Pork'], dislikes: ['Olives'] }), {
    dietaryAllergies: ['Peanuts'], dietaryRestrictions: ['Vegan'], dietaryDislikes: ['Pork', 'Olives'],
  });
});

test('every plan-required allergy label (Milk, Egg) and restriction label (Dairy-free, Gluten-free) matches its broader alias set, not just its own literal word', () => {
  const milk = findFoodPreferenceConflicts(['cheese sauce'], { allergies: ['Milk'], restrictions: [], avoidances: [], dislikes: [] });
  assert.ok(milk.some((item) => item.preference === 'Milk' && item.ingredient === 'cheese sauce'));

  const egg = findFoodPreferenceConflicts(['mayonnaise'], { allergies: ['Egg'], restrictions: [], avoidances: [], dislikes: [] });
  assert.ok(egg.some((item) => item.preference === 'Egg' && item.ingredient === 'mayonnaise'));

  const dairyFree = findFoodPreferenceConflicts(['buttered toast'], { allergies: [], restrictions: ['Dairy-free'], avoidances: [], dislikes: [] });
  assert.ok(dairyFree.some((item) => item.preference === 'Dairy-free' && item.ingredient === 'buttered toast'));

  const glutenFree = findFoodPreferenceConflicts(['pasta salad'], { allergies: [], restrictions: ['Gluten-free'], avoidances: [], dislikes: [] });
  assert.ok(glutenFree.some((item) => item.preference === 'Gluten-free' && item.ingredient === 'pasta salad'));
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
