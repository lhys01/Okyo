import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldLoadNotifications } from './notificationRuntime';

test('notification module is not loaded on a Simulator or web', () => {
  assert.equal(shouldLoadNotifications('ios', false), false);
  assert.equal(shouldLoadNotifications('web', true), false);
});

test('notification module remains available on a physical device', () => {
  assert.equal(shouldLoadNotifications('ios', true), true);
  assert.equal(shouldLoadNotifications('android', true), true);
});
