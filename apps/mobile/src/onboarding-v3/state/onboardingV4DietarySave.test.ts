import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyDietarySafetyAnswers } from './dietaryContracts';
import { saveOnboardingV4DietarySafety } from './onboardingV4DietarySave';

/**
 * Storage-touching success/failure paths are covered by
 * state/dietaryPreferencesAuthority.test.ts against injectable in-memory
 * storage — this module's exported function is bound to the real singleton
 * persistence modules (module-level `onboardingV3Persistence`/
 * `foodPreferencesPersistence`, both wrapping the native AsyncStorage
 * module), which is not safely exercisable under this repo's plain
 * `node:test` runner outside a React Native runtime. What IS safely
 * testable here without touching storage is the validation guard.
 */
test('refuses to save an unanswered draft without touching storage', async () => {
  const result = await saveOnboardingV4DietarySafety(emptyDietarySafetyAnswers);
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.match(result.message, /choose/i);
});
