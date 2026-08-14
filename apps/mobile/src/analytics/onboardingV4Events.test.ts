import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { onboardingV4Events, sanitizeOnboardingV4EventProperties } from './onboardingV4Events';

const EXPECTED_22_EVENT_NAMES = [
  'onboarding_started',
  'onboarding_screen_viewed',
  'onboarding_answer_submitted',
  'primary_goal_selected',
  'personal_insight_viewed',
  'dietary_preferences_saved',
  'personal_plan_viewed',
  'first_scan_input_selected',
  'camera_permission_prompted',
  'camera_permission_result',
  'photo_confirmed',
  'analysis_started',
  'analysis_succeeded',
  'analysis_failed',
  'first_recipe_revealed',
  'meaningful_action_selected',
  'paywall_viewed',
  'purchase_started',
  'purchase_succeeded',
  'purchase_failed',
  'purchase_restored',
  'onboarding_completed',
];

test('every event name is unique', () => {
  const names = Object.values(onboardingV4Events);
  assert.equal(new Set(names).size, names.length, 'duplicate event name found in onboardingV4Events');
});

test('contains exactly the 22 event names required by the corrected Step 02 taxonomy', () => {
  assert.equal(Object.values(onboardingV4Events).length, 22);
  assert.deepEqual(Object.values(onboardingV4Events).sort(), [...EXPECTED_22_EVENT_NAMES].sort());
});

test('none of the retired incorrect substitute names remain', () => {
  const names: Set<string> = new Set(Object.values(onboardingV4Events));
  for (const retired of ['checkout_started', 'purchase_completed', 'recipe_viewed', 'premium_action_selected', 'onboarding_insight_viewed', 'onboarding_plan_viewed', 'scan_entry_viewed', 'dish_submitted', 'analysis_completed']) {
    assert.equal(names.has(retired), false, `retired substitute event name still present: ${retired}`);
  }
});

test("the 22 event values match analytics/track.ts's ONBOARDING_V4_* entries value-for-value", () => {
  // track.ts statically imports react-native, which esbuild/tsx cannot
  // transform under the plain node:test runner (pre-existing repo limitation,
  // confirmed independently of this change) — so this reads the source text
  // instead of importing the module, to keep the single-source-of-truth
  // claim in onboardingV4Events.ts's header comment actually verified.
  const trackSource = readFileSync(resolve(process.cwd(), 'src/analytics/track.ts'), 'utf8');
  for (const name of EXPECTED_22_EVENT_NAMES) {
    assert.match(trackSource, new RegExp(`:\\s*'${name}'`), `track.ts is missing an ONBOARDING_V4_* entry with value '${name}'`);
  }
});

test('typed properties accept only the allow-listed fields', () => {
  const sanitized = sanitizeOnboardingV4EventProperties({
    screen: 'promise',
    step: 'promise',
    branch: 'save_money',
    source: 'onboarding',
    actionType: 'tap',
    permissionResult: 'granted',
    errorKind: 'network',
    durationMs: 42,
    isMinor: false,
  });
  assert.deepEqual(sanitized, {
    screen: 'promise',
    step: 'promise',
    branch: 'save_money',
    source: 'onboarding',
    actionType: 'tap',
    permissionResult: 'granted',
    errorKind: 'network',
    durationMs: 42,
    isMinor: false,
  });
});

test('sensitive properties are stripped, not forwarded, even when injected via a dynamically-built object', () => {
  const sensitivePayload: Record<string, unknown> = {
    screen: 'dietarySafety',
    name: 'Megan',
    userName: 'megan_c',
    email: 'megan@example.com',
    allergies: ['peanuts'],
    dietaryNotes: 'severe shellfish allergy',
    ageYears: 16,
    heightCm: 170,
    weightKg: 60,
    biologicalSex: 'female',
    photoUri: 'file:///var/mobile/photo.jpg',
    mealDescription: 'a bowl of pad thai with extra peanuts',
  };

  const sanitized = sanitizeOnboardingV4EventProperties(sensitivePayload);

  assert.deepEqual(sanitized, { screen: 'dietarySafety' });
  for (const sensitiveKey of ['name', 'userName', 'email', 'allergies', 'dietaryNotes', 'ageYears', 'heightCm', 'weightKg', 'biologicalSex', 'photoUri', 'mealDescription']) {
    assert.equal(Object.prototype.hasOwnProperty.call(sanitized, sensitiveKey), false, `sensitive key leaked through: ${sensitiveKey}`);
  }
});

test('an all-sensitive payload with no allow-listed fields sanitizes to an empty object', () => {
  const sanitized = sanitizeOnboardingV4EventProperties({
    name: 'Megan',
    dishDescription: 'leftover lasagna',
    photo: 'file:///photo.jpg',
  });
  assert.deepEqual(sanitized, {});
});
