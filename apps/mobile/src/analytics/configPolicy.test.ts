import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsAllowed } from './configPolicy';

const base = { posthogKey: 'public-test-key', posthogHost: 'https://us.i.posthog.com', projectId: '584818' };

test('analytics is disabled without the matching environment opt-in', () => {
  assert.equal(analyticsAllowed({ ...base, environment: 'development' }), false);
  assert.equal(analyticsAllowed({ ...base, environment: 'development', enabledEnvironment: 'false' }), false);
  assert.equal(analyticsAllowed({ ...base, environment: 'production', enabledEnvironment: 'production' }), false);
});

test('Development requires its confirmed project, US Cloud and Development opt-in', () => {
  assert.equal(analyticsAllowed({ ...base, environment: 'development', enabledEnvironment: 'development' }), true);
  assert.equal(analyticsAllowed({ ...base, projectId: '123', environment: 'development', enabledEnvironment: 'development' }), false);
  assert.equal(analyticsAllowed({ ...base, posthogHost: 'https://eu.i.posthog.com', environment: 'development', enabledEnvironment: 'development' }), false);
});

test('Production cannot use the Development project ID', () => {
  assert.equal(analyticsAllowed({ ...base, environment: 'production', enabledEnvironment: 'production' }), false);
  assert.equal(analyticsAllowed({ ...base, projectId: '123', environment: 'production', enabledEnvironment: 'production' }), true);
  assert.equal(analyticsAllowed({ ...base, posthogKey: '', projectId: '123', environment: 'production', enabledEnvironment: 'production' }), false);
});
