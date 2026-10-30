import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY,
  createCanonicalOnboardingPersistence,
} from './persistence';
import { PERSONALIZED_PROFILE_STORAGE_KEY, PERSONALIZED_PROGRESS_STORAGE_KEY } from '../../onboarding-v3/state/onboardingV3Persistence';
import { emptyPersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('legacy V3 draft is authoritative over a canonical mirror', async () => {
  const storage = memoryStorage();
  storage.values.set(PERSONALIZED_PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Legacy user', primaryGoal: 'save_money', secondaryGoals: ['save_money'] }));
  storage.values.set(PERSONALIZED_PROGRESS_STORAGE_KEY, 'question2');
  storage.values.set(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, profile: { name: 'Mirror user', primaryGoal: 'hit_macros' }, resumeStep: 'question9' }));

  const snapshot = await createCanonicalOnboardingPersistence(storage).readSnapshot();
  assert.equal(snapshot.profile.name, 'Legacy user');
  assert.equal(snapshot.profile.primaryGoal, 'save_money');
  assert.equal(snapshot.resumeStep, 'question2');
});

test('canonical snapshot is a safe fallback when a V3 install has no legacy draft', async () => {
  const storage = memoryStorage();
  storage.values.set(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, profile: { name: 'Migrated user', primaryGoal: 'eat_healthier', secondaryGoals: ['eat_healthier'] }, resumeStep: 'branchDemo' }));

  const snapshot = await createCanonicalOnboardingPersistence(storage).readSnapshot();
  assert.equal(snapshot.profile.name, 'Migrated user');
  assert.equal(snapshot.profile.primaryGoal, 'eat_healthier');
  assert.equal(snapshot.resumeStep, 'branchDemo');
});

test('writes preserve V3 keys, mirror a versioned snapshot, and reset only owned keys', async () => {
  const storage = memoryStorage();
  storage.values.set('unrelated', 'keep');
  const persistence = createCanonicalOnboardingPersistence(storage);
  await persistence.writeSnapshot({ profile: { ...emptyPersonalizedProfile, name: 'Megan', primaryGoal: 'eat_healthier', secondaryGoals: ['eat_healthier'] }, resumeStep: 'question3' });

  assert.ok(storage.values.has(PERSONALIZED_PROFILE_STORAGE_KEY));
  assert.equal(storage.values.get(PERSONALIZED_PROGRESS_STORAGE_KEY), 'question3');
  assert.equal(JSON.parse(storage.values.get(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY) ?? '').schemaVersion, 1);

  await persistence.reset();
  assert.equal(storage.values.has(PERSONALIZED_PROFILE_STORAGE_KEY), false);
  assert.equal(storage.values.has(PERSONALIZED_PROGRESS_STORAGE_KEY), false);
  assert.equal(storage.values.has(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY), false);
  assert.equal(storage.values.get('unrelated'), 'keep');
});
