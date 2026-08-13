import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTRIBUTION_STORAGE_KEY,
  createOnboardingV3Persistence,
  DIETARY_STORAGE_KEY,
  MASCOT_NAME_STORAGE_KEY,
  PERSONALIZED_PROFILE_STORAGE_KEY,
  PERSONALIZED_PROGRESS_STORAGE_KEY,
} from '../onboarding-v3/state/onboardingV3Persistence';

test('V3 reset clears only V3 onboarding preferences', async () => {
  const values = new Map<string, string>([
    [MASCOT_NAME_STORAGE_KEY, 'Miso'],
    [ATTRIBUTION_STORAGE_KEY, 'instagram'],
    [DIETARY_STORAGE_KEY, '{"restrictions":["Dairy"],"dislikes":[]}'],
    [PERSONALIZED_PROFILE_STORAGE_KEY, '{"name":"Megan","primaryGoal":"save_money"}'],
    [PERSONALIZED_PROGRESS_STORAGE_KEY, 'paywall'],
    ['recipesById', '{"recipe-1":{}}'],
    ['savedRecipeIds', '["recipe-1"]'],
    ['groceryRecipeIds', '["recipe-1"]'],
    ['xp', '120'],
  ]);
  const persistence = createOnboardingV3Persistence({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  });
  await persistence.reset();
  assert.equal(values.has(MASCOT_NAME_STORAGE_KEY), false);
  assert.equal(values.has(ATTRIBUTION_STORAGE_KEY), false);
  assert.equal(values.has(DIETARY_STORAGE_KEY), false);
  assert.equal(values.has(PERSONALIZED_PROFILE_STORAGE_KEY), false);
  assert.equal(values.has(PERSONALIZED_PROGRESS_STORAGE_KEY), false);
  assert.equal(values.get('recipesById'), '{"recipe-1":{}}');
  assert.equal(values.get('savedRecipeIds'), '["recipe-1"]');
  assert.equal(values.get('groceryRecipeIds'), '["recipe-1"]');
  assert.equal(values.get('xp'), '120');
});
