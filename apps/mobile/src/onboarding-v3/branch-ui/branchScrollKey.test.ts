import assert from 'node:assert/strict';
import test from 'node:test';

import { branchScrollKey } from './branchScrollKey';

test('branch scroll identity resets for forward and backward question transitions', () => {
  const friction = branchScrollKey('save_money', 'friction');
  const weeklySnapshot = branchScrollKey('save_money', 'weeklySnapshot');

  assert.notEqual(friction, weeklySnapshot);
  assert.equal(branchScrollKey('save_money', 'friction'), friction);
  assert.notEqual(branchScrollKey('hit_macros', 'friction'), friction);
});
