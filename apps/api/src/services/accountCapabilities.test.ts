import assert from 'node:assert/strict';
import test from 'node:test';
import { getAccountCapabilities } from './accountCapabilities.js';

test('capabilities derive from the verified subject and never return private membership', () => {
  const configured = 'user_owner123,user_other456,invalid-id';
  assert.deepEqual(getAccountCapabilities('user_owner123', configured), { canManageOnboardingExperiments: true });
  assert.deepEqual(getAccountCapabilities('user_stranger', configured), { canManageOnboardingExperiments: false });
  assert.deepEqual(getAccountCapabilities('', configured), { canManageOnboardingExperiments: false });
  assert.deepEqual(getAccountCapabilities('invalid-id', configured), { canManageOnboardingExperiments: false });
  assert.deepEqual(getAccountCapabilities('user_owner123', ''), { canManageOnboardingExperiments: false });
  assert.ok(!JSON.stringify(getAccountCapabilities('user_owner123', configured)).includes('user_'));
});
