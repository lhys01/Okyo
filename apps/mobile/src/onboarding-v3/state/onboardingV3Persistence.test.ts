import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTRIBUTION_STORAGE_KEY,
  createOnboardingV3Persistence,
  DIETARY_STORAGE_KEY,
  MASCOT_NAME_STORAGE_KEY,
  PERSONALIZED_PROFILE_STORAGE_KEY,
  PERSONALIZED_PROGRESS_STORAGE_KEY,
} from './onboardingV3Persistence';
import { emptyPersonalizedProfile } from './personalizedOnboarding';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('V3 persistence sanitizes values, survives reload, and resets only its owned keys', async () => {
  const storage = createMemoryStorage();
  const persistence = createOnboardingV3Persistence(storage);
  storage.values.set('okyo:unrelated', 'keep');

  assert.equal(await persistence.writeMascotName('  Saffron  '), 'Saffron');
  await persistence.writeAttribution('friends_family');
  await persistence.writeDietary({ restrictions: ['Dairy', 'Dairy'], dislikes: ['Olives'] });
  await persistence.writePersonalizedProfile({
    ...emptyPersonalizedProfile,
    name: ' Megan ', primaryGoal: 'save_money', secondaryGoals: ['cook_more'],
    answers: { takeoutFrequency: '2–3 times a week', spendPerMeal: 25 },
    savings: { ...emptyPersonalizedProfile.savings, takeoutFrequency: '2–3 times a week', spendPerMeal: 25 },
    dietaryRestrictions: ['Vegetarian'], dietaryOther: '',
  });
  await persistence.writePersonalizedProgress('branchDemo');

  assert.equal(await persistence.readMascotName(), 'Saffron');
  assert.equal(await persistence.readAttribution(), 'friends_family');
  assert.deepEqual(await persistence.readDietary(), { allergies: [], restrictions: ['Dairy'], avoidances: [], dislikes: ['Olives'] });
  assert.equal((await persistence.readPersonalizedProfile()).name, 'Megan');
  assert.deepEqual((await persistence.readPersonalizedProfile()).secondaryGoals, ['save_money', 'cook_more']);
  assert.equal(await persistence.readPersonalizedProgress(), 'branchDemo');

  await persistence.reset();
  assert.equal(storage.values.has(MASCOT_NAME_STORAGE_KEY), false);
  assert.equal(storage.values.has(ATTRIBUTION_STORAGE_KEY), false);
  assert.equal(storage.values.has(DIETARY_STORAGE_KEY), false);
  assert.equal(storage.values.has(PERSONALIZED_PROFILE_STORAGE_KEY), false);
  assert.equal(storage.values.has(PERSONALIZED_PROGRESS_STORAGE_KEY), false);
  assert.equal(storage.values.get('okyo:unrelated'), 'keep');
});

test('V3 persistence fails safely on corrupt or unknown stored values', async () => {
  const storage = createMemoryStorage();
  const persistence = createOnboardingV3Persistence(storage);
  storage.values.set(ATTRIBUTION_STORAGE_KEY, 'television');
  storage.values.set(DIETARY_STORAGE_KEY, '{broken');
  storage.values.set(MASCOT_NAME_STORAGE_KEY, '   ');

  assert.equal(await persistence.readAttribution(), null);
  assert.deepEqual(await persistence.readDietary(), { allergies: [], restrictions: [], avoidances: [], dislikes: [] });
  assert.equal(await persistence.readMascotName(), 'Kiko');
});
