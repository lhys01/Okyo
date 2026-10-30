import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  ATTRIBUTION_STORAGE_KEY,
  DIETARY_STORAGE_KEY,
  MASCOT_NAME_STORAGE_KEY,
  PERSONALIZED_PROFILE_STORAGE_KEY,
  PERSONALIZED_PROGRESS_STORAGE_KEY,
} from '../../onboarding-v3/state/onboardingV3Persistence';
import { HEALTH_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/healthBranchPersistence';
import { MACROS_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/macrosBranchPersistence';
import { SAVE_MONEY_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/saveMoneyBranchPersistence';
import { APP_FEATURE_TOUR_STORAGE_KEY } from '../../tour/tourPersistence';
import { CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, createCanonicalOnboardingPersistence } from './persistence';
import { resetCanonicalOnboarding } from './reset';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('Settings invokes the canonical reset contract without product analytics', () => {
  const settings = readFileSync(resolve(process.cwd(), 'src/screens/SettingsScreen.tsx'), 'utf8');
  assert.match(settings, /resetCanonicalOnboarding\(\{[\s\S]*?resetCanonicalPersistence: \(\) => Promise\.all\(\[[\s\S]*?canonicalOnboardingPersistence\.reset\(\),[\s\S]*?saveMoneyBranchPersistence\.reset\(\),[\s\S]*?healthBranchPersistence\.reset\(\),[\s\S]*?macrosBranchPersistence\.reset\(\),[\s\S]*?resetSession: resetOnboarding,[\s\S]*?resetTour: \(\) => tourPersistence\.resetStatus\(\)/);
  assert.doesNotMatch(settings, /track\(analyticsEvents.ONBOARDING_RESET/);
});

test('reset waits for canonical persistence before clearing the in-memory session', async () => {
  const calls: string[] = [];
  let releasePersistence!: () => void;
  const persistence = new Promise<void>((resolve) => { releasePersistence = resolve; });
  const reset = resetCanonicalOnboarding({
    resetCanonicalPersistence: () => { calls.push('persistence'); return persistence; },
    resetTour: async () => { calls.push('tour'); },
    resetSession: () => { calls.push('session'); },
    onError: (scope) => calls.push(`error:${scope}`),
  });
  assert.deepEqual(calls, ['persistence']);
  releasePersistence();
  const result = await reset;
  assert.deepEqual(result, { reset: true });
  assert.deepEqual(calls, ['persistence', 'tour', 'session']);
});

test('persistence failure leaves the current session mounted instead of reopening stale onboarding', async () => {
  const calls: string[] = [];
  const persistenceFailure = new Error('persistence');
  const tourFailure = new Error('tour');
  const result = await resetCanonicalOnboarding({
    resetCanonicalPersistence: async () => { calls.push('persistence'); throw persistenceFailure; },
    resetTour: async () => { calls.push('tour'); throw tourFailure; },
    resetSession: () => { calls.push('session'); },
    onError: (scope, error) => { assert.equal(error, scope === 'persistence' ? persistenceFailure : tourFailure); calls.push(`error:${scope}`); },
  });
  assert.deepEqual(result, { reset: false });
  assert.deepEqual(calls, ['persistence', 'error:persistence']);
});

test('canonical reset removes all active V3 onboarding keys while preserving V4, preview, and unrelated data', async () => {
  const storage = memoryStorage(new Map([
    [MASCOT_NAME_STORAGE_KEY, 'Kiko'],
    [ATTRIBUTION_STORAGE_KEY, 'friends_family'],
    [DIETARY_STORAGE_KEY, '{}'],
    [PERSONALIZED_PROFILE_STORAGE_KEY, '{}'],
    [PERSONALIZED_PROGRESS_STORAGE_KEY, 'branchDemo'],
    [CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, '{}'],
    [HEALTH_BRANCH_STORAGE_KEY, '{}'],
    [SAVE_MONEY_BRANCH_STORAGE_KEY, '{}'],
    [MACROS_BRANCH_STORAGE_KEY, '{}'],
    ['okyo:onboarding-preview:keep', '{}'],
    ['app:unrelated', 'keep'],
  ]));
  await createCanonicalOnboardingPersistence(storage).reset();
  for (const key of [MASCOT_NAME_STORAGE_KEY, ATTRIBUTION_STORAGE_KEY, DIETARY_STORAGE_KEY, PERSONALIZED_PROFILE_STORAGE_KEY, PERSONALIZED_PROGRESS_STORAGE_KEY, CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY]) assert.equal(storage.values.has(key), false);
  for (const key of [HEALTH_BRANCH_STORAGE_KEY, SAVE_MONEY_BRANCH_STORAGE_KEY, MACROS_BRANCH_STORAGE_KEY]) assert.equal(storage.values.has(key), false);
  for (const key of ['okyo:onboarding-preview:keep', 'app:unrelated']) assert.equal(storage.values.has(key), true);
});

test('reset remains repeatable when canonical keys are missing or corrupt', async () => {
  const storage = memoryStorage(new Map([
    [CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, '{invalid'],
    [APP_FEATURE_TOUR_STORAGE_KEY, 'completed'],
  ]));
  const persistence = createCanonicalOnboardingPersistence(storage);
  let sessions = 0;
  const request = {
    resetCanonicalPersistence: () => persistence.reset(),
    resetTour: async () => { await storage.removeItem(APP_FEATURE_TOUR_STORAGE_KEY); },
    resetSession: () => { sessions += 1; },
    onError: () => assert.fail('reset should tolerate absent/corrupt stored values'),
  };
  await Promise.all([resetCanonicalOnboarding(request), resetCanonicalOnboarding(request)]);
  assert.equal(sessions, 2);
  assert.equal(storage.values.has(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY), false);
  assert.equal(storage.values.has(APP_FEATURE_TOUR_STORAGE_KEY), false);
});
