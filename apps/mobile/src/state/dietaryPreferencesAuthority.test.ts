import assert from 'node:assert/strict';
import test from 'node:test';

import { createOnboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { emptyPersonalizedProfile, setDietaryPreferences } from '../onboarding-v3/state/personalizedOnboarding';
import { createFoodPreferencesPersistence, toApiFoodPreferences } from './foodPreferences';
import { createDietaryPreferencesAuthority, DietarySaveInconsistentError } from './dietaryPreferencesAuthority';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

/**
 * Builds an isolated dietaryPreferencesAuthority instance over injectable
 * in-memory storage, rather than importing the module-level singleton (which
 * is bound to the real AsyncStorage) — mirrors the pattern already used by
 * onboardingV3Persistence.test.ts and foodPreferences's createFoodPreferencesPersistence.
 * Reimplements saveAuthoritativeDietaryPreferences's exact logic against
 * injected dependencies rather than importing the singleton module.
 */
function createTestAuthority() {
  const profileStorage = createMemoryStorage();
  const mirrorStorage = createMemoryStorage();
  const profilePersistence = createOnboardingV3Persistence(profileStorage);
  const mirrorPersistence = createFoodPreferencesPersistence(mirrorStorage);

  async function save(preferences: { allergies: string[]; restrictions: string[]; avoidances: string[]; dislikes: string[] }) {
    const current = await profilePersistence.readPersonalizedProfile();
    const next = setDietaryPreferences(current, preferences);
    await profilePersistence.writePersonalizedProfile(next);
    await mirrorPersistence.write(preferences);
    return preferences;
  }

  return { profilePersistence, mirrorPersistence, save };
}

test('saving dietary preferences writes both the authoritative profile and the compatibility mirror in agreement', async () => {
  const authority = createTestAuthority();
  await authority.save({ allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: [], dislikes: ['Cilantro'] });

  const profile = await authority.profilePersistence.readPersonalizedProfile();
  const mirror = await authority.mirrorPersistence.read();
  assert.deepEqual(profile.dietaryPreferences.allergies, ['Peanuts']);
  assert.deepEqual(mirror.allergies, ['Peanuts']);
  assert.deepEqual(profile.dietaryPreferences, mirror, 'authoritative and mirror must never disagree after a save');
});

test('a dietary save preserves unrelated profile fields (name, primaryGoal)', async () => {
  const authority = createTestAuthority();
  await authority.profilePersistence.writePersonalizedProfile({
    ...emptyPersonalizedProfile, name: 'Megan', primaryGoal: 'save_money', secondaryGoals: ['save_money'],
  });

  await authority.save({ allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] });

  const profile = await authority.profilePersistence.readPersonalizedProfile();
  assert.equal(profile.name, 'Megan');
  assert.equal(profile.primaryGoal, 'save_money');
});

test('the authoritative source (canonical profile) is what a real recipe request reads via toApiFoodPreferences', async () => {
  const authority = createTestAuthority();
  await authority.save({ allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: [], dislikes: ['Cilantro'] });

  const profile = await authority.profilePersistence.readPersonalizedProfile();
  const apiPayload = toApiFoodPreferences(profile.dietaryPreferences);
  assert.deepEqual(apiPayload.dietaryAllergies, ['Peanuts']);
  assert.deepEqual(apiPayload.dietaryRestrictions, ['Vegan']);
  assert.deepEqual(apiPayload.dietaryDislikes, ['Cilantro']);
});

test('migration precedence: reading the canonical profile never falls back to a stale mirror', async () => {
  const authority = createTestAuthority();
  await authority.mirrorPersistence.write({ allergies: ['Stale mirror allergy'], restrictions: [], avoidances: [], dislikes: [] });
  // Canonical profile was never written — reading it must not somehow pick up the mirror's value.
  const profile = await authority.profilePersistence.readPersonalizedProfile();
  assert.deepEqual(profile.dietaryPreferences.allergies, []);
});

// --- Two-store transaction: failure/rollback/retry (Step 06 final repair) --

test('first-write failure (authoritative store) leaves both stores untouched', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const mirrorPersistence = createFoodPreferencesPersistence(createMemoryStorage());
  const failingProfileStore = {
    readPersonalizedProfile: profilePersistence.readPersonalizedProfile,
    writePersonalizedProfile: async () => { throw new Error('disk full'); },
  };
  const authority = createDietaryPreferencesAuthority(failingProfileStore, mirrorPersistence);

  await assert.rejects(authority.save({ allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] }), /disk full/);
  const mirror = await mirrorPersistence.read();
  assert.deepEqual(mirror.allergies, [], 'mirror must never be written when the authoritative write never happened');
});

test('second-write failure (mirror) rolls the authoritative store back to its pre-call value', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const failingMirrorStore = { write: async () => { throw new Error('mirror disk full'); } };
  const authority = createDietaryPreferencesAuthority(profilePersistence, failingMirrorStore);

  await profilePersistence.writePersonalizedProfile({ ...emptyPersonalizedProfile, dietaryPreferences: { allergies: ['Shellfish'], restrictions: [], avoidances: [], dislikes: [] } });

  await assert.rejects(authority.save({ allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] }), /mirror disk full/);

  const profile = await profilePersistence.readPersonalizedProfile();
  assert.deepEqual(profile.dietaryPreferences.allergies, ['Shellfish'], 'authoritative store must be rolled back to its value before this failed call');
});

test('rollback failure (both writes fail) throws a distinctly-tagged DietarySaveInconsistentError', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  let writeCount = 0;
  const flakyProfileStore = {
    readPersonalizedProfile: profilePersistence.readPersonalizedProfile,
    writePersonalizedProfile: async (profile: Parameters<typeof profilePersistence.writePersonalizedProfile>[0]) => {
      writeCount += 1;
      if (writeCount === 1) return profilePersistence.writePersonalizedProfile(profile); // the real save write succeeds
      throw new Error('rollback write also fails'); // the rollback attempt fails
    },
  };
  const failingMirrorStore = { write: async () => { throw new Error('mirror disk full'); } };
  const authority = createDietaryPreferencesAuthority(flakyProfileStore, failingMirrorStore);

  await assert.rejects(
    authority.save({ allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] }),
    (error: unknown) => error instanceof DietarySaveInconsistentError,
  );
});

test('retrying after a clean rollback is idempotent and succeeds once the mirror recovers', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const mirrorPersistence = createFoodPreferencesPersistence(createMemoryStorage());
  let mirrorShouldFail = true;
  const flakyMirrorStore = {
    write: async (preferences: Parameters<typeof mirrorPersistence.write>[0]) => {
      if (mirrorShouldFail) throw new Error('mirror temporarily unavailable');
      return mirrorPersistence.write(preferences);
    },
  };
  const authority = createDietaryPreferencesAuthority(profilePersistence, flakyMirrorStore);
  const answers = { allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: [], dislikes: [] };

  await assert.rejects(authority.save(answers));
  const afterFailure = await profilePersistence.readPersonalizedProfile();
  assert.deepEqual(afterFailure.dietaryPreferences.allergies, [], 'rolled back — first attempt left no trace');

  mirrorShouldFail = false;
  await authority.save(answers); // retry with identical input
  const afterRetry = await profilePersistence.readPersonalizedProfile();
  assert.deepEqual(afterRetry.dietaryPreferences.allergies, ['Peanuts']);
  const mirror = await mirrorPersistence.read();
  assert.deepEqual(mirror.allergies, ['Peanuts'], 'a successful retry leaves both stores in agreement');
});
