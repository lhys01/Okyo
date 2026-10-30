import assert from 'node:assert/strict';
import test from 'node:test';

import { isClerkConfigured } from './clerkRuntime';

test('release builds accept only a live Clerk publishable key', () => {
  assert.equal(isClerkConfigured('pk_live_release_key', false), true);
  assert.equal(isClerkConfigured('pk_test_development_key', false), false);
  assert.equal(isClerkConfigured('', false), false);
});

test('development builds may use a Clerk test key without changing release rules', () => {
  assert.equal(isClerkConfigured('pk_test_development_key', true), true);
  assert.equal(isClerkConfigured('not-a-key', true), false);
});
