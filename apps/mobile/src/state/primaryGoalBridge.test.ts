import assert from 'node:assert/strict';
import test from 'node:test';

import { PRIMARY_GOAL_PROFILE_KEY, readPersonalizedHomeProfile, readPrimaryGoalFromProfile } from './primaryGoalBridge';
import { emptyPersonalizedProfile } from '../onboarding-v3/state/personalizedOnboarding';
import { PERSONALIZED_PROFILE_SCHEMA_VERSION } from '../onboarding-v3/state/onboardingV3Persistence';

function storageWith(value: string | null) {
  const keys: string[] = [];
  return { keys, async getItem(key: string) { keys.push(key); return value; } };
}

test('reads a schema-versioned envelope written by onboardingV3Persistence, not just legacy unwrapped data', async () => {
  const envelope = {
    schemaVersion: PERSONALIZED_PROFILE_SCHEMA_VERSION,
    profile: { ...emptyPersonalizedProfile, name: 'Megan', primaryGoal: 'hit_macros', secondaryGoals: ['hit_macros'] },
  };
  const storage = storageWith(JSON.stringify(envelope));

  const home = await readPersonalizedHomeProfile(storage);
  assert.deepEqual(home, { name: 'Megan', primaryGoal: 'hit_macros' });
  assert.deepEqual(storage.keys, [PRIMARY_GOAL_PROFILE_KEY]);
});

test('still reads the pre-versioning unwrapped legacy shape', async () => {
  const storage = storageWith(JSON.stringify({ ...emptyPersonalizedProfile, name: 'Legacy', primaryGoal: 'save_money', secondaryGoals: ['save_money'] }));
  assert.equal(await readPrimaryGoalFromProfile(storage), 'save_money');
});

test('returns null (never throws) for missing, corrupt, or goal-less stored profiles', async () => {
  assert.equal(await readPersonalizedHomeProfile(storageWith(null)), null);
  assert.equal(await readPersonalizedHomeProfile(storageWith('{not json')), null);
  assert.equal(await readPersonalizedHomeProfile(storageWith(JSON.stringify({ ...emptyPersonalizedProfile, primaryGoal: null }))), null);
});

test('a retired/unrecognized primaryGoal value (e.g. an old cook_more primary) fails safely to null', async () => {
  assert.equal(await readPrimaryGoalFromProfile(storageWith(JSON.stringify({ primaryGoal: 'cook_more' }))), null);
});

test('storage key matches the one onboardingV3Persistence writes to', () => {
  assert.equal(PRIMARY_GOAL_PROFILE_KEY, 'okyo:personalized-onboarding-profile:v1');
});
