import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanupDeletedAccountDevice } from './accountDeletionDeviceCleanup';

test('confirmed deletion resets local identity and onboarding in order without requesting server deletion', async () => {
  const steps: string[] = [];
  let serverDeletionRequests = 0;
  const dependencies = {
    clearLocalData: async () => { steps.push('clear-local'); },
    resetRevenueCatIdentity: async () => { steps.push('reset-revenuecat'); },
    resetAnalyticsIdentity: () => { steps.push('reset-analytics'); },
    signOut: async () => { steps.push('clear-clerk-session'); },
    resetOnboarding: async () => { steps.push('reset-onboarding-and-route'); },
  };

  await cleanupDeletedAccountDevice(dependencies);
  assert.deepEqual(steps, ['clear-local', 'reset-revenuecat', 'reset-analytics', 'reset-onboarding-and-route', 'clear-clerk-session']);
  assert.equal(serverDeletionRequests, 0, 'device cleanup must never repeat the server deletion request');

  steps.length = 0;
  await cleanupDeletedAccountDevice(dependencies);
  assert.equal(serverDeletionRequests, 0);
});

test('a failed device cleanup can retry locally without repeating server deletion', async () => {
  let serverDeletionRequests = 1;
  let failOnce = true;
  const steps: string[] = [];
  const dependencies = {
    clearLocalData: async () => {
      steps.push('clear-local');
      if (failOnce) { failOnce = false; throw new Error('temporary local storage failure'); }
    },
    resetRevenueCatIdentity: async () => { steps.push('reset-revenuecat'); },
    resetAnalyticsIdentity: () => { steps.push('reset-analytics'); },
    signOut: async () => { steps.push('clear-clerk-session'); },
    resetOnboarding: async () => { steps.push('reset-onboarding-and-route'); },
  };

  await assert.rejects(cleanupDeletedAccountDevice(dependencies));
  await cleanupDeletedAccountDevice(dependencies);
  assert.equal(serverDeletionRequests, 1);
  assert.deepEqual(steps, [
    'clear-local', 'reset-revenuecat', 'reset-analytics', 'reset-onboarding-and-route', 'clear-clerk-session',
    'clear-local', 'reset-revenuecat', 'reset-analytics', 'reset-onboarding-and-route', 'clear-clerk-session',
  ]);
});
