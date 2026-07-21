import assert from 'node:assert/strict';
import test from 'node:test';

import { getShareStatusCopy, type ShareLifecycle } from './shareLifecycle';

test('every share lifecycle state has useful public copy', () => {
  const states: ShareLifecycle[] = ['ready', 'preparing', 'shared', 'copied', 'cancelled', 'failed'];
  for (const state of states) {
    const copy = getShareStatusCopy(state);
    assert.ok(copy.title.length > 4);
    assert.ok(copy.body.length > 8);
  }
});

test('cancelled state makes it clear nothing was posted', () => {
  assert.match(getShareStatusCopy('cancelled').body, /nothing was posted/i);
});
