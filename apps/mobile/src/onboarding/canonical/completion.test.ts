import assert from 'node:assert/strict';
import test from 'node:test';

import { commitCanonicalOnboardingCompletion } from './completion';

test('canonical completion persists before activating the app shell', async () => {
  const calls: string[] = [];
  const result = await commitCanonicalOnboardingCompletion({
    writeCompletion: async () => { calls.push('persist'); },
    activateApp: () => { calls.push('activate'); },
  });
  assert.deepEqual(result, { completed: true });
  assert.deepEqual(calls, ['persist', 'activate']);
});

test('a new onboarding completion prepares the tour before activating the app', async () => {
  const calls: string[] = [];
  await commitCanonicalOnboardingCompletion({
    prepareTour: async () => { calls.push('prepare-tour'); },
    writeCompletion: async () => { calls.push('persist-onboarding'); },
    activateApp: () => { calls.push('activate'); },
  });
  assert.deepEqual(calls, ['prepare-tour', 'persist-onboarding', 'activate']);
});

test('a failed tour preparation does not navigate past onboarding', async () => {
  const calls: string[] = [];
  await assert.rejects(commitCanonicalOnboardingCompletion({
    prepareTour: async () => { throw new Error('storage unavailable'); },
    writeCompletion: async () => { calls.push('persist-onboarding'); },
    activateApp: () => { calls.push('activate'); },
  }), /storage unavailable/);
  assert.deepEqual(calls, []);
});
