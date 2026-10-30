import assert from 'node:assert/strict';
import test from 'node:test';

import { createOnboardingPersistence, ONBOARDING_COMPLETED_STORAGE_KEY } from './onboardingPersistence';
import { resetOnboardingSession } from './onboardingResetSession';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('session reset removes the completion flag before mutating in-memory onboarding state', async () => {
  const calls: string[] = [];
  let release!: () => void;
  const cleanup = new Promise<void>((resolve) => { release = resolve; });
  const reset = resetOnboardingSession({
    resetMemory: () => calls.push('memory'),
    resetCompletionFlag: () => { calls.push('completion'); return cleanup; },
    logCompletionFlagResetError: () => calls.push('log:error'),
  });
  assert.deepEqual(calls, ['completion']);
  release();
  await reset;
  assert.deepEqual(calls, ['completion', 'memory']);
});

test('completion cleanup failure leaves completed in-memory reset intact and logs once without retry', async () => {
  const calls: string[] = [];
  const failure = new Error('storage unavailable');
  await resetOnboardingSession({
    resetMemory: () => calls.push('memory'),
    resetCompletionFlag: async () => { calls.push('completion'); throw failure; },
    logCompletionFlagResetError: (error) => { assert.equal(error, failure); calls.push('log:error'); },
  });
  assert.deepEqual(calls, ['completion', 'log:error', 'memory']);
});

test('session reset is repeatable and preserves unrelated state owned by its caller', async () => {
  const calls: string[] = [];
  const state = { onboarding: true, weeklyGoal: 'three', savedRecipe: 'keep' };
  const reset = () => resetOnboardingSession({
    resetMemory: () => {
      state.onboarding = false;
      state.weeklyGoal = 'none';
      calls.push('memory');
    },
    resetCompletionFlag: async () => { calls.push('completion'); },
    logCompletionFlagResetError: () => calls.push('log:error'),
  });
  await Promise.all([reset(), reset()]);
  assert.deepEqual(calls, ['completion', 'completion', 'memory', 'memory']);
  assert.deepEqual(state, { onboarding: false, weeklyGoal: 'none', savedRecipe: 'keep' });
});

test('already-absent completion flag is a successful unawaited cleanup', async () => {
  const storage = memoryStorage();
  const persistence = createOnboardingPersistence(storage);
  let memoryResets = 0;
  await resetOnboardingSession({
    resetMemory: () => { memoryResets += 1; },
    resetCompletionFlag: () => persistence.resetCompleted(),
    logCompletionFlagResetError: () => assert.fail('missing key is not an error'),
  });
  assert.equal(memoryResets, 1);
  assert.equal(storage.values.has(ONBOARDING_COMPLETED_STORAGE_KEY), false);
});
