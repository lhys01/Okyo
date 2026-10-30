import assert from 'node:assert/strict';
import test from 'node:test';
import { isOnboardingExperimentAdmin } from './onboardingExperimentAdmin';

test('onboarding experiment controls require a signed-in account in the admin allowlist', () => {
  assert.equal(isOnboardingExperimentAdmin(false, 'owner@example.com', 'owner@example.com'), false);
  assert.equal(isOnboardingExperimentAdmin(true, null, 'owner@example.com'), false);
  assert.equal(isOnboardingExperimentAdmin(true, 'user@example.com', 'owner@example.com'), false);
  assert.equal(isOnboardingExperimentAdmin(true, ' OWNER@example.com ', 'owner@example.com,other@example.com'), true);
});

test('empty admin allowlist keeps experiment controls hidden', () => {
  assert.equal(isOnboardingExperimentAdmin(true, 'owner@example.com', ' , '), false);
});
