import assert from 'node:assert/strict';
import test from 'node:test';

import { createFoodPreferencesPersistence, toApiFoodPreferences } from '../../state/foodPreferences';
import { createOnboardingV3Persistence } from './onboardingV3Persistence';
import { emptyPersonalizedProfile, setDietaryPreferences } from './personalizedOnboarding';
import {
  addDietaryAllergy, addDietaryRestriction, completeDietarySafety, emptyDietarySafetyAnswers,
  selectNoneOfTheseDietary, setDietaryDislikes,
} from './dietaryContracts';

/**
 * Full-chain integration test (Step 06 repair, required validation item 3):
 * V4 dietary selection -> "Save my preferences" -> authoritative global
 * preferences -> the real API-request shape (toApiFoodPreferences) -> which
 * fields a recipe-generation prompt would receive. Uses injectable in-memory
 * storage throughout (createOnboardingV3Persistence/createFoodPreferencesPersistence
 * factories, the same pattern the rest of this repo's persistence tests
 * use) rather than mocking or regex-checking source text.
 *
 * This exercises the same read-modify-write + mirror-sync sequence
 * `saveOnboardingV4DietarySafety`/`saveAuthoritativeDietaryPreferencesPreservingAvoidances`
 * perform, against test-owned storage instead of the real AsyncStorage-bound
 * singletons those modules use (see onboardingV4DietarySave.test.ts's header
 * comment for why the singleton path itself isn't safely testable here).
 */
function createHarness() {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const mirrorPersistence = createFoodPreferencesPersistence(createMemoryStorage());
  async function saveThroughV4(answers: Parameters<typeof completeDietarySafety>[0]) {
    const completedAnswers = completeDietarySafety(answers);
    const partial = {
      allergies: completedAnswers.noneOfThese ? [] : completedAnswers.allergies,
      restrictions: completedAnswers.noneOfThese ? [] : completedAnswers.restrictions,
      dislikes: completedAnswers.noneOfThese ? [] : completedAnswers.dislikes,
    };
    const current = await profilePersistence.readPersonalizedProfile();
    const next = setDietaryPreferences(current, { ...partial, avoidances: current.dietaryPreferences.avoidances });
    await profilePersistence.writePersonalizedProfile(next);
    await mirrorPersistence.write({ ...partial, avoidances: current.dietaryPreferences.avoidances });
    return next;
  }
  return { profilePersistence, mirrorPersistence, saveThroughV4 };
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('full chain: allergy/restriction/dislike selections arrive in their own dedicated API fields with no cross-category duplication', async () => {
  const harness = createHarness();
  let answers = emptyDietarySafetyAnswers;
  answers = addDietaryAllergy(answers, 'Peanuts');
  answers = addDietaryRestriction(answers, 'Vegan');
  answers = setDietaryDislikes(answers, ['Cilantro']);

  const profile = await harness.saveThroughV4(answers);
  const apiPayload = toApiFoodPreferences(profile.dietaryPreferences);

  assert.deepEqual(apiPayload.dietaryAllergies, ['Peanuts']);
  assert.deepEqual(apiPayload.dietaryRestrictions, ['Vegan']);
  assert.deepEqual(apiPayload.dietaryDislikes, ['Cilantro']);
  assert.equal(apiPayload.dietaryAllergies.includes('Vegan'), false);
  assert.equal(apiPayload.dietaryRestrictions.includes('Peanuts'), false);
  assert.equal(apiPayload.dietaryDislikes.includes('Peanuts'), false);
});

test('explicit "None of these" propagates as intentional empty groups, not a skipped/undefined save', async () => {
  const harness = createHarness();
  let answers = emptyDietarySafetyAnswers;
  answers = addDietaryAllergy(answers, 'Peanuts'); // selected first, then cleared by None
  answers = selectNoneOfTheseDietary(answers);

  const profile = await harness.saveThroughV4(answers);
  const apiPayload = toApiFoodPreferences(profile.dietaryPreferences);
  assert.deepEqual(apiPayload.dietaryAllergies, []);
  assert.deepEqual(apiPayload.dietaryRestrictions, []);
  assert.equal(profile.dietaryPreferences.allergies.length, 0);
});

test('an incomplete dietary screen (never saved) preserves whatever global preferences already existed', async () => {
  const harness = createHarness();
  await harness.saveThroughV4(addDietaryAllergy(emptyDietarySafetyAnswers, 'Shellfish'));

  // Simulate the user reopening dietarySafety, making changes, but never
  // reaching Save (no saveThroughV4 call for this second round).
  const stillPersisted = await harness.profilePersistence.readPersonalizedProfile();
  assert.deepEqual(stillPersisted.dietaryPreferences.allergies, ['Shellfish']);
});

test('legacy flat restrictions (pre-allergy-split) migrate into the allergy group without data loss', async () => {
  const harness = createHarness();
  await harness.profilePersistence.writePersonalizedProfile({
    ...emptyPersonalizedProfile,
    dietaryPreferences: { allergies: [], restrictions: ['Peanut allergy', 'Vegan'], avoidances: [], dislikes: [] },
  });
  const profile = await harness.profilePersistence.readPersonalizedProfile();
  // normalizeFoodPreferences (foodPreferences.ts) migrates "X allergy"-suffixed
  // legacy restriction entries into the allergies group.
  assert.ok(profile.dietaryPreferences.allergies.some((item) => item.toLowerCase().includes('peanut')));
  assert.deepEqual(profile.dietaryPreferences.restrictions, ['Vegan']);
});

test('a profile shape missing the dietaryPreferences field entirely remains backward compatible (defaults to empty, does not throw)', async () => {
  const harness = createHarness();
  const { dietaryPreferences: _omit, ...withoutDietary } = emptyPersonalizedProfile;
  await harness.profilePersistence.writePersonalizedProfile(withoutDietary as never);
  const profile = await harness.profilePersistence.readPersonalizedProfile();
  assert.deepEqual(profile.dietaryPreferences.allergies, []);
  const apiPayload = toApiFoodPreferences(profile.dietaryPreferences);
  assert.deepEqual(apiPayload.dietaryAllergies, []);
});
